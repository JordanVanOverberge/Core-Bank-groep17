const express        = require('express');
const router         = express.Router();
const pool           = require('../db');
const { getCBToken } = require('../services/cbToken');
const auth           = require('../middleware/auth');
const notifs         = require('../notifications');

const ok   = (res, data, msg = 'OK', status = 200) =>
  res.status(status).json({ ok: true,  status, code: 2000,          message: msg, data });
const fail = (res, msg, status = 500, code = null) =>
  res.status(status).json({ ok: false, status, code: code ?? status * 10, message: msg, data: [] });

const genId = () =>
  `${process.env.BIC}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
const now   = () =>
  new Date().toISOString().slice(0, 19).replace('T', ' ');

const MAX_AMOUNT = 500;

const CB_CODES = {
  4001: 'Interne betaling – niet naar CB sturen',
  4002: 'Bedrag is te hoog (max 500 euro)',
  4003: 'Bedrag is negatief of nul',
  4004: 'De bank van de ontvanger bestaat niet op het netwerk',
  4005: 'De PO is al verstuurd (duplicate po_id in po_out)',
  4006: 'PO_ID is ongeldig (moet beginnen met eigen BIC)',
};

function localValidate(po, knownBanks = []) {
  if (po.po_amount <= 0)              return 4003;
  if (po.po_amount > MAX_AMOUNT)      return 4002;
  if (po.bb_id === process.env.BIC)   return 4001;
  if (!po.po_id.startsWith(process.env.BIC + '_')) return 4006;
  if (knownBanks.length > 0 && !knownBanks.some(b => (b.id ?? b.bic) === po.bb_id)) return 4004;
  return null;
}

// ─── GET /api/po_new_generate ─────────────────────────────────────────────────
router.get('/po_new_generate', async (req, res) => {
  const count = Math.min(parseInt(req.query.count) || 3, 20);
  const min   = Math.max(parseFloat(req.query.min)  || 1,   0.01);
  const max   = Math.min(parseFloat(req.query.max)  || 500, MAX_AMOUNT);

  if (min >= max)
    return fail(res, 'min moet kleiner zijn dan max', 400, 4000);

  try {
    const [accounts] = await pool.query('SELECT id FROM accounts');
    if (!accounts.length)
      return fail(res, 'Geen accounts in database om POs van te genereren', 400, 4000);

    let externalBanks = [];
    try {
      const token  = await getCBToken();
      const cbRes  = await fetch(`${process.env.CB_URL}/banks`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const cbData = await cbRes.json();
      externalBanks = (cbData.data || []).filter(b => (b.id ?? b.bic) !== process.env.BIC);
    } catch (_) {}

    const generated = [];
    for (let i = 0; i < count; i++) {
      const oa     = accounts[Math.floor(Math.random() * accounts.length)];
      const amount = parseFloat((Math.random() * (max - min) + min).toFixed(2));
      const po_id  = genId();

      let bb_id, ba_id;
      if (externalBanks.length > 0 && Math.random() > 0.3) {
        const bank = externalBanks[Math.floor(Math.random() * externalBanks.length)];
        bb_id = bank.id ?? bank.bic;
        ba_id = bank.iban ?? `BE${String(Math.floor(Math.random() * 1e14)).padStart(14, '0')}`;
      } else {
        const dest = accounts[Math.floor(Math.random() * accounts.length)];
        bb_id = process.env.BIC;
        ba_id = dest.id;
      }

      await pool.query(
        `INSERT INTO po_new (po_id, po_amount, po_message, po_datetime, ob_id, oa_id, bb_id, ba_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [po_id, amount, `Test betaling ${i + 1}`, now(), process.env.BIC, oa.id, bb_id, ba_id]
      );
      generated.push({ po_id, po_amount: amount, bb_id, ba_id });
    }

    notifs.push('success', `${count} willekeurige PO('s) gegenereerd`);
    ok(res, generated, `${count} willekeurige PO('s) gegenereerd`);
  } catch (err) {
    notifs.push('error', `Fout bij PO genereren: ${err.message}`);
    fail(res, err.message);
  }
});

// ─── POST /api/po_new_add ─────────────────────────────────────────────────────
router.post('/po_new_add', async (req, res) => {
  const pos = req.body?.data;
  if (!Array.isArray(pos) || pos.length === 0)
    return fail(res, 'Geen PO data (verwacht: { "data": [...] })', 400, 4000);

  try {
    for (const po of pos) {
      await pool.query(
        `INSERT INTO po_new (po_id, po_amount, po_message, po_datetime, ob_id, oa_id, bb_id, ba_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [po.po_id ?? genId(), po.po_amount, po.po_message, now(),
         process.env.BIC, po.oa_id, po.bb_id, po.ba_id]
      );
    }
    notifs.push('info', `${pos.length} PO('s) toegevoegd aan po_new`);
    ok(res, [], `${pos.length} PO('s) toegevoegd aan po_new`);
  } catch (err) {
    notifs.push('error', `Fout bij PO toevoegen: ${err.message}`);
    fail(res, err.message);
  }
});

// ─── GET /api/po_new_process ──────────────────────────────────────────────────
router.get('/po_new_process', async (_req, res) => {
  try {
    const [pos] = await pool.query('SELECT * FROM po_new');
    if (pos.length === 0) return ok(res, [], 'Geen POs om te verwerken');

    // Create a pending TX for every PO upfront (isvalid=0, iscomplete=0)
    for (const po of pos) {
      try {
        await pool.query(
          `INSERT IGNORE INTO transactions (id, amount, datetime, po_id, account_id, isvalid, iscomplete)
           VALUES (?, ?, ?, ?, ?, 0, 0)`,
          [`TXN_${po.po_id}`, po.po_amount, now(), po.po_id, po.oa_id]);
      } catch (_) {}
    }

    const internal = [];
    const external = [];
    const rejected = [];
    const processedInternal = [];

    // Fetch CB bank list for 4004 validation (don't block if CB unreachable)
    let cbBanks = [];
    try {
      const token  = await getCBToken();
      const cbRes  = await fetch(`${process.env.CB_URL}/banks`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const cbData = await cbRes.json();
      cbBanks = cbData.data || [];
    } catch (_) {}

    for (const po of pos) {
      // 4005: check if po_id already exists in po_out (duplicate)
      const [dup] = await pool.query('SELECT po_id FROM po_out WHERE po_id = ?', [po.po_id]);
      if (dup.length > 0) {
        rejected.push({ po_id: po.po_id, code: 4005, reason: CB_CODES[4005] });
        continue;
      }
      const errCode = localValidate(po, cbBanks); //give code 4001 for internal POs
      if (errCode === 4001) { internal.push(po); continue; }
      if (errCode)          { rejected.push({ po_id: po.po_id, code: errCode, reason: CB_CODES[errCode] }); continue; }
      external.push(po);
    }

    // --- Interne betalingen verwerken (geen CB nodig) ---
    for (const po of internal) {
      const ts = now();
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        // Reserve money from sender account
        const [senderRows] = await conn.query('SELECT balance FROM accounts WHERE id = ? FOR UPDATE', [po.oa_id]);
        if (!senderRows.length || parseFloat(senderRows[0].balance) < parseFloat(po.po_amount)) {
          await conn.rollback();
          rejected.push({ po_id: po.po_id, code: 'INSUFFICIENT_FUNDS', reason: 'Onvoldoende saldo' });
          await pool.query(
            'UPDATE transactions SET isvalid=0, iscomplete=1 WHERE id = ? AND iscomplete=0',
            [`TXN_${po.po_id}`]);
          await pool.query('DELETE FROM po_new WHERE po_id = ?', [po.po_id]);
          await pool.query('INSERT INTO log (datetime, type, message, po_id) VALUES (?, ?, ?, ?)',
            [ts, 'po_rejected', 'Geweigerd: onvoldoende saldo', po.po_id]);
          continue;
        }
        await conn.query('UPDATE accounts SET balance = balance - ? WHERE id = ?', [po.po_amount, po.oa_id]);

        // Move from po_new to po_out
        await conn.query(
          `INSERT IGNORE INTO po_out (po_id, po_amount, po_message, po_datetime, ob_id, oa_id, bb_id, ba_id)
           SELECT po_id, po_amount, po_message, po_datetime, ob_id, oa_id, bb_id, ba_id
           FROM po_new WHERE po_id = ?`, [po.po_id]);
        await conn.query('DELETE FROM po_new WHERE po_id = ?', [po.po_id]);

        // Check if recipient exists
        const [recipientRows] = await conn.query('SELECT id FROM accounts WHERE id = ?', [po.ba_id]);
        if (recipientRows.length === 0) {
            await conn.rollback(); // Refund
            rejected.push({ po_id: po.po_id, code: 'RECIPIENT_NOT_FOUND', reason: 'Ontvanger niet gevonden' });
            await pool.query(
                'UPDATE transactions SET isvalid=0, iscomplete=1 WHERE id = ? AND iscomplete=0',
                [`TXN_${po.po_id}`]);
            await pool.query('INSERT INTO log (datetime, type, message, po_id) VALUES (?, ?, ?, ?)',
                [ts, 'po_rejected', 'Geweigerd: ontvanger niet gevonden', po.po_id]);
            continue;
        }

        // Transfer money to recipient
        await conn.query('UPDATE accounts SET balance = balance + ? WHERE id = ?', [po.po_amount, po.ba_id]);

        // Finalize transaction
        await conn.query(
          'UPDATE transactions SET isvalid=1, iscomplete=1 WHERE id = ?',
          [`TXN_${po.po_id}`]);
        await conn.query(
          `INSERT IGNORE INTO transactions (id, amount, datetime, po_id, account_id, isvalid, iscomplete)
           VALUES (?, ?, ?, ?, ?, 1, 1)`,
          [`TXN_CREDIT_${po.po_id}`, po.po_amount, ts, po.po_id, po.ba_id]);
        await conn.query('INSERT INTO log (datetime, type, message, po_id) VALUES (?, ?, ?, ?)',
          [ts, 'po_internal', 'Interne betaling verwerkt', po.po_id]);

        processedInternal.push(po);
        await conn.commit();
      } catch (error) {
        await conn.rollback();
        // Refund money if something went wrong
        await pool.query('UPDATE accounts SET balance = balance + ? WHERE id = ?', [po.po_amount, po.oa_id]);
        rejected.push({ po_id: po.po_id, code: 'INTERNAL_ERROR', reason: `Interne fout: ${error.message}` });
        await pool.query(
            'UPDATE transactions SET isvalid=0, iscomplete=1 WHERE id = ? AND iscomplete=0',
            [`TXN_${po.po_id}`]);
        await pool.query('INSERT INTO log (datetime, type, message, po_id) VALUES (?, ?, ?, ?)',
            [ts, 'po_rejected', `Geweigerd: interne fout - ${error.message}`, po.po_id]);
      } finally {
        conn.release();
      }
    }

    // --- Ongeldige POs uit po_new verwijderen ---
    for (const r of rejected) {
      await pool.query('DELETE FROM po_new WHERE po_id = ?', [r.po_id]);
      try {
        await pool.query(
          'UPDATE transactions SET isvalid=0, iscomplete=1 WHERE id = ? AND iscomplete=0',
          [`TXN_${r.po_id}`]);
        await pool.query(
          'INSERT INTO log (datetime, type, message, po_id) VALUES (?, ?, ?, ?)',
          [now(), 'po_rejected', `Geweigerd (code ${r.code}): ${r.reason}`, r.po_id]);
      } catch (_) {}
    }

    // --- Externe POs naar CB sturen — geld reserveren voor verzending ---
    let cbResult = null;
    const externalReady = [];
    if (external.length > 0) {
      let token;
      try { token = await getCBToken(); }
      catch (e) { return fail(res, `CB token fout: ${e.message}`, 502, 5002); }

      for (const po of external) {
        const conn2 = await pool.getConnection();
        try {
          await conn2.beginTransaction();
          const [senderRows] = await conn2.query(
            'SELECT balance FROM accounts WHERE id = ? FOR UPDATE', [po.oa_id]);
          if (!senderRows.length || parseFloat(senderRows[0].balance) < parseFloat(po.po_amount)) {
            await conn2.rollback();
            rejected.push({ po_id: po.po_id, code: 'INSUFFICIENT_FUNDS', reason: 'Onvoldoende saldo voor externe betaling' });
            await pool.query(
              'UPDATE transactions SET isvalid=0, iscomplete=1 WHERE id = ? AND iscomplete=0',
              [`TXN_${po.po_id}`]);
            await pool.query('DELETE FROM po_new WHERE po_id = ?', [po.po_id]);
            await pool.query('INSERT INTO log (datetime, type, message, po_id) VALUES (?, ?, ?, ?)',
              [now(), 'po_rejected', 'Geweigerd: onvoldoende saldo voor externe betaling', po.po_id]);
            continue;
          }
          await conn2.query('UPDATE accounts SET balance = balance - ? WHERE id = ?', [po.po_amount, po.oa_id]);
          await conn2.commit();
          externalReady.push(po);
        } catch (err) {
          await conn2.rollback();
          rejected.push({ po_id: po.po_id, code: 'INTERNAL_ERROR', reason: `Interne fout: ${err.message}` });
          await pool.query(
            'UPDATE transactions SET isvalid=0, iscomplete=1 WHERE id = ? AND iscomplete=0',
            [`TXN_${po.po_id}`]);
          await pool.query('DELETE FROM po_new WHERE po_id = ?', [po.po_id]);
        } finally {
          conn2.release();
        }
      }

      if (externalReady.length > 0) {
        try {
          const cbRes = await fetch(`${process.env.CB_URL}/po_in`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ data: externalReady })
          });
          cbResult = await cbRes.json();
          if (!cbRes.ok) {
            // CB rejected — refund reserved amounts
            for (const po of externalReady) {
              await pool.query('UPDATE accounts SET balance = balance + ? WHERE id = ?', [po.po_amount, po.oa_id]);
              await pool.query(
                'UPDATE transactions SET isvalid=0, iscomplete=1 WHERE id = ? AND iscomplete=0',
                [`TXN_${po.po_id}`]);
              try {
                await pool.query('INSERT INTO log (datetime, type, message, po_id) VALUES (?, ?, ?, ?)',
                  [now(), 'po_out', `CB weigerde PO (teruggestort): ${JSON.stringify(cbResult)}`, po.po_id]);
              } catch (_) {}
            }
            return fail(res, `CB weigerde POs: ${JSON.stringify(cbResult)}`, 502, 5002);
          }
          for (const po of externalReady) {
            const ts = now();
            await pool.query(
              `INSERT IGNORE INTO po_out (po_id, po_amount, po_message, po_datetime, ob_id, oa_id, bb_id, ba_id)
               SELECT po_id, po_amount, po_message, po_datetime, ob_id, oa_id, bb_id, ba_id
               FROM po_new WHERE po_id = ?`, [po.po_id]);
            await pool.query('DELETE FROM po_new WHERE po_id = ?', [po.po_id]);
            try {
              await pool.query('INSERT INTO log (datetime, type, message, po_id) VALUES (?, ?, ?, ?)',
                [ts, 'po_out', 'PO verstuurd naar CB (geld gereserveerd)', po.po_id]);
            } catch (_) {}
          }
        } catch (e) {
          // Network error — refund reserved amounts
          for (const po of externalReady) {
            await pool.query('UPDATE accounts SET balance = balance + ? WHERE id = ?', [po.po_amount, po.oa_id]);
            await pool.query(
              'UPDATE transactions SET isvalid=0, iscomplete=1 WHERE id = ? AND iscomplete=0',
              [`TXN_${po.po_id}`]);
            try {
              await pool.query('INSERT INTO log (datetime, type, message, po_id) VALUES (?, ?, ?, ?)',
                [now(), 'po_out', 'CB niet bereikbaar - geld teruggestort', po.po_id]);
            } catch (_) {}
          }
          return fail(res, `CB niet bereikbaar: ${e.message}`, 502, 5002);
        }
      }
    }

    if (rejected.length > 0)
      notifs.push('warning', `${rejected.length} PO('s) geweigerd bij verwerking`);
    if (processedInternal.length > 0)
      notifs.push('success', `${processedInternal.length} interne betaling(en) verwerkt`);
    if (externalReady.length > 0)
      notifs.push('success', `${externalReady.length} externe PO('s) verstuurd naar CB`);

    ok(res, {
      internal: processedInternal.length,
      internal_details: processedInternal.map(po => ({ po_id: po.po_id, code: 4001, reason: CB_CODES[4001] })),
      external: externalReady.length,
      rejected: rejected.length,
      rejected_details: rejected,
      cb_response: cbResult
    }, `Verwerkt: ${processedInternal.length} intern, ${externalReady.length} extern, ${rejected.length} geweigerd`);

  } catch (err) {
    notifs.push('error', `Fout bij PO verwerken: ${err.message}`);
    fail(res, err.message);
  }
});

module.exports = router;
