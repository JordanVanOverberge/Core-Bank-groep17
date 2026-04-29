const express = require('express');
const router  = express.Router();
const { pool } = require('../db');
const cb = require('../middleware/cbApi');

const BIC   = () => process.env.BANK_BIC;
const now   = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const genId = () => `${BIC()}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

const ok   = (res, data = null, msg = null, status = 200) =>
  res.status(status).json({ ok: true,  status, code: 2000, message: msg, data });
const fail = (res, code, msg, status = 400) =>
  res.status(status).json({ ok: false, status, code, message: msg, data: null });

const MAX_AMOUNT = 500;
const CB_CODES = {
  4001: 'Interne betaling – niet naar CB sturen',
  4002: `Bedrag is te hoog (max ${MAX_AMOUNT} euro)`,
  4003: 'Bedrag is negatief of nul',
};

function localValidate(po) {
  if (po.po_amount <= 0)         return 4003;
  if (po.po_amount > MAX_AMOUNT) return 4002;
  if (po.bb_id === BIC())        return 4001;
  return null;
}

// ─── GET /api/po_new_generate ─────────────────────────────────────────────────
router.get('/po_new_generate', async (req, res) => {
  const count = Math.min(parseInt(req.query.count) || 3, 20);
  const min   = Math.max(parseFloat(req.query.min)  || 1,   0.01);
  const max   = Math.min(parseFloat(req.query.max)  || 500, MAX_AMOUNT);

  if (min >= max)
    return fail(res, 4000, 'min moet kleiner zijn dan max', 400);

  try {
    const [accounts] = await pool.query('SELECT id FROM accounts');
    if (!accounts.length)
      return fail(res, 4000, 'Geen accounts in database', 400);

    let externalBanks = [];
    try {
      const data = await cb.fetchBanks();
      externalBanks = (data.data || []).filter(b => b.bic !== BIC());
    } catch (_) {}

    const generated = [];
    for (let i = 0; i < count; i++) {
      const oa     = accounts[Math.floor(Math.random() * accounts.length)];
      const amount = parseFloat((Math.random() * (max - min) + min).toFixed(2));
      const po_id  = genId();

      let bb_id, ba_id;
      if (externalBanks.length > 0 && Math.random() > 0.3) {
        const bank = externalBanks[Math.floor(Math.random() * externalBanks.length)];
        bb_id = bank.bic;
        ba_id = bank.iban ?? `BE${String(Math.floor(Math.random() * 1e14)).padStart(14, '0')}`;
      } else {
        const dest = accounts[Math.floor(Math.random() * accounts.length)];
        bb_id = BIC();
        ba_id = dest.id;
      }

      // Valideer VOOR opslag (gegenereerde POs zijn doorgaans geldig)
      const tempPo = { po_id, po_amount: amount, bb_id, ba_id };
      const errCode = localValidate(tempPo);
      if (errCode && errCode !== 4001) continue; // sla ongeldige over
      await pool.query(
        `INSERT INTO po_new (po_id, po_amount, po_message, po_datetime, ob_id, oa_id, bb_id, ba_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [po_id, amount, `Test betaling ${i + 1}`, now(), BIC(), oa.id, bb_id, ba_id]
      );
      generated.push({ po_id, po_amount: amount, bb_id, ba_id });
    }

    return ok(res, generated, `${count} willekeurige PO('s) gegenereerd`);
  } catch (err) {
    return fail(res, 'SERVER_ERROR', err.message, 500);
  }
});

// ─── POST /api/po_new_add ─────────────────────────────────────────────────────
// Validatie gebeurt VOOR de PO in po_new wordt opgeslagen.
router.post('/po_new_add', async (req, res) => {
  const pos = req.body?.data;
  if (!Array.isArray(pos) || pos.length === 0)
    return fail(res, 4000, 'Geen PO data (verwacht: { "data": [...] })', 400);

  try {
    const added = [], rejected = [];
    for (const po of pos) {
      const po_id = genId();
      // Valideer VOOR opslag: 4002/4003 worden geweigerd; 4001 (intern) is geldig
      const errCode = localValidate({ ...po, po_id });
      if (errCode && errCode !== 4001) {
        rejected.push({ po_id, code: errCode, reason: CB_CODES[errCode] });
        continue;
      }
      await pool.query(
        `INSERT INTO po_new (po_id, po_amount, po_message, po_datetime, ob_id, oa_id, bb_id, ba_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [po_id, po.po_amount, po.po_message, now(), BIC(), po.oa_id, po.bb_id, po.ba_id]
      );
      added.push(po_id);
    }
    return ok(res, { added, rejected },
      `${added.length} PO('s) toegevoegd aan po_new, ${rejected.length} geweigerd voor opslag`);
  } catch (err) {
    return fail(res, 'SERVER_ERROR', err.message, 500);
  }
});

// ─── GET /api/po_new_process ──────────────────────────────────────────────────
router.get('/po_new_process', async (_req, res) => {
  try {
    const [pos] = await pool.query('SELECT * FROM po_new');
    if (pos.length === 0) return ok(res, [], 'Geen POs om te verwerken');

    const internal = [], external = [], rejected = [];

    for (const po of pos) {
      const errCode = localValidate(po);
      if (errCode === 4001) { internal.push(po); continue; }
      if (errCode)          { rejected.push({ po_id: po.po_id, code: errCode, reason: CB_CODES[errCode] }); continue; }
      external.push(po);
    }

    // Internal payments (no CB needed)
    for (const po of internal) {
      const ts = now();
      const [senderRows] = await pool.query('SELECT balance FROM accounts WHERE id = ?', [po.oa_id]);
      if (!senderRows.length || senderRows[0].balance < po.po_amount) {
        rejected.push({ po_id: po.po_id, code: 'INSUFFICIENT_FUNDS', reason: 'Onvoldoende saldo' });
        await pool.query('DELETE FROM po_new WHERE po_id = ?', [po.po_id]);
        await pool.query('INSERT INTO log (datetime, type, message, po_id) VALUES (?, ?, ?, ?)',
          [ts, 'po_rejected', 'Geweigerd: onvoldoende saldo', po.po_id]);
        continue;
      }
      await pool.query(
        `INSERT IGNORE INTO po_out (po_id, po_amount, po_message, po_datetime, ob_id, oa_id, bb_id, ba_id)
         SELECT po_id, po_amount, po_message, po_datetime, ob_id, oa_id, bb_id, ba_id
         FROM po_new WHERE po_id = ?`, [po.po_id]);
      await pool.query('DELETE FROM po_new WHERE po_id = ?', [po.po_id]);
      await pool.query('UPDATE accounts SET balance = balance - ? WHERE id = ?', [po.po_amount, po.oa_id]);
      await pool.query('UPDATE accounts SET balance = balance + ? WHERE id = ?', [po.po_amount, po.ba_id]);
      await pool.query('INSERT INTO log (datetime, type, message, po_id) VALUES (?, ?, ?, ?)',
        [ts, 'po_internal', 'Interne betaling verwerkt', po.po_id]);
    }

    // Ongeldige POs: verplaats naar po_out met foutcode (TX mislukt / rood)
    for (const r of rejected) {
      const ts = now();
      await pool.query(
        `INSERT IGNORE INTO po_out (po_id, po_amount, po_message, po_datetime, ob_id, oa_id, ob_code, ob_datetime, bb_id, ba_id)
         SELECT po_id, po_amount, po_message, po_datetime, ob_id, oa_id, ?, ?, bb_id, ba_id
         FROM po_new WHERE po_id = ?`, [r.code, ts, r.po_id]);
      await pool.query('DELETE FROM po_new WHERE po_id = ?', [r.po_id]);
      await pool.query('INSERT INTO log (datetime, type, message, po_id) VALUES (?, ?, ?, ?)',
        [ts, 'po_rejected', `Geweigerd (code ${r.code}): ${r.reason}`, r.po_id]);
    }

    // Externe POs naar CB sturen (met saldocheck + debitering)
    let cbResult = null;
    const toSend = [];
    if (external.length > 0) {
      for (const po of external) {
        const ts = now();
        const [senderRows] = await pool.query('SELECT balance FROM accounts WHERE id = ?', [po.oa_id]);
        if (!senderRows.length || senderRows[0].balance < po.po_amount) {
          await pool.query(
            `INSERT IGNORE INTO po_out (po_id, po_amount, po_message, po_datetime, ob_id, oa_id, ob_code, ob_datetime, bb_id, ba_id)
             SELECT po_id, po_amount, po_message, po_datetime, ob_id, oa_id, ?, ?, bb_id, ba_id
             FROM po_new WHERE po_id = ?`, ['INSUF', ts, po.po_id]);
          await pool.query('DELETE FROM po_new WHERE po_id = ?', [po.po_id]);
          await pool.query('INSERT INTO log (datetime, type, message, po_id) VALUES (?, ?, ?, ?)',
            [ts, 'po_rejected', 'Geweigerd: onvoldoende saldo (externe betaling)', po.po_id]);
          rejected.push({ po_id: po.po_id, code: 'INSUFFICIENT_FUNDS', reason: 'Onvoldoende saldo' });
          continue;
        }
        toSend.push(po);
      }

      if (toSend.length > 0) {
        try {
          cbResult = await cb.sendPoToCb(toSend);
        } catch (e) {
          return fail(res, 5002, `CB niet bereikbaar: ${e.message}`, 502);
        }
        for (const po of toSend) {
          const ts = now();
          await pool.query(
            `INSERT IGNORE INTO po_out (po_id, po_amount, po_message, po_datetime, ob_id, oa_id, ob_code, ob_datetime, bb_id, ba_id)
             SELECT po_id, po_amount, po_message, po_datetime, ob_id, oa_id, ?, ?, bb_id, ba_id
             FROM po_new WHERE po_id = ?`, [2000, ts, po.po_id]);
          await pool.query('DELETE FROM po_new WHERE po_id = ?', [po.po_id]);
          // Debiteer zender: saldo verlagen bij verzending
          await pool.query('UPDATE accounts SET balance = balance - ? WHERE id = ?', [po.po_amount, po.oa_id]);
          // Maak openstaande transactie aan (iscomplete=0 tot ACK)
          await pool.query(
            `INSERT IGNORE INTO transactions (id, amount, datetime, po_id, account_id, isvalid, iscomplete)
             VALUES (?, ?, ?, ?, ?, 1, 0)`,
            [`TXN_OUT_${po.po_id}`, -po.po_amount, ts, po.po_id, po.oa_id]);
          await pool.query('INSERT INTO log (datetime, type, message, po_id) VALUES (?, ?, ?, ?)',
            [ts, 'po_out', 'PO verstuurd naar CB – saldo gereserveerd', po.po_id]);
        }
      }
    }

    return ok(res, {
      internal: internal.length,
      external: toSend.length,
      rejected: rejected.length,
      rejected_details: rejected,
      cb_response: cbResult,
    }, `Verwerkt: ${internal.length} intern, ${toSend.length} extern, ${rejected.length} geweigerd`);
  } catch (err) {
    return fail(res, 'SERVER_ERROR', err.message, 500);
  }
});

// ─── GET /api/cb/poll_po ──────────────────────────────────────────────────────
router.get('/cb/poll_po', async (_req, res) => {
  try {
    const data = await cb.fetchPoFromCb();
    const pos  = data.data || [];
    const acks = [];

    for (const po of pos) {
      const ts = now();
      const [account] = await pool.query('SELECT * FROM accounts WHERE id = ?', [po.ba_id]);
      const isvalid = account.length > 0 && po.po_amount > 0 ? 1 : 0;
      const bb_code = isvalid ? 2000 : 4004;

      await pool.query(
        `INSERT IGNORE INTO po_in
           (po_id, po_amount, po_message, po_datetime, ob_id, oa_id, ob_code, ob_datetime,
            cb_code, cb_datetime, bb_id, ba_id, bb_code, bb_datetime)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [po.po_id, po.po_amount, po.po_message, po.po_datetime,
         po.ob_id, po.oa_id, po.ob_code||null, po.ob_datetime||null,
         po.cb_code||null, po.cb_datetime||null,
         po.bb_id, po.ba_id, bb_code, ts]);

      if (isvalid) {
        await pool.query('UPDATE accounts SET balance = balance + ? WHERE id = ?', [po.po_amount, po.ba_id]);
        await pool.query(
          `INSERT IGNORE INTO transactions (id, amount, datetime, po_id, account_id, isvalid, iscomplete)
           VALUES (?, ?, ?, ?, ?, 1, 1)`,
          [`TXN_${po.po_id}`, po.po_amount, ts, po.po_id, po.ba_id]);
      }

      const ack = {
        po_id: po.po_id, po_amount: po.po_amount, po_message: po.po_message, po_datetime: po.po_datetime,
        ob_id: po.ob_id, oa_id: po.oa_id, ob_code: po.ob_code||null, ob_datetime: po.ob_datetime||null,
        cb_code: po.cb_code||null, cb_datetime: po.cb_datetime||null,
        bb_id: BIC(), ba_id: po.ba_id, bb_code, bb_datetime: ts,
      };

      await pool.query(
        `INSERT IGNORE INTO ack_out
           (po_id, po_amount, po_message, po_datetime, ob_id, oa_id, ob_code, ob_datetime,
            cb_code, cb_datetime, bb_id, ba_id, bb_code, bb_datetime)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [ack.po_id, ack.po_amount, ack.po_message, ack.po_datetime,
         ack.ob_id, ack.oa_id, ack.ob_code, ack.ob_datetime,
         ack.cb_code, ack.cb_datetime,
         ack.bb_id, ack.ba_id, ack.bb_code, ack.bb_datetime]);

      await pool.query('INSERT INTO log (datetime, message, type, po_id) VALUES (?, ?, ?, ?)',
        [ts, isvalid ? 'Inkomende PO verwerkt' : 'Inkomende PO geweigerd', 'PO_IN', po.po_id]);

      acks.push(ack);
    }

    if (acks.length > 0) await cb.sendAckIn(acks);

    return ok(res, acks, `${pos.length} inkomende PO('s) verwerkt`);
  } catch (err) {
    return fail(res, 'SERVER_ERROR', err.message, 500);
  }
});

// ─── GET /api/cb/poll_ack ─────────────────────────────────────────────────────
router.get('/cb/poll_ack', async (_req, res) => {
  try {
    const data = await cb.fetchAckOut();
    const acks = data.data || [];
    for (const ack of acks) {
      const ts = now();
      await pool.query(
        `INSERT IGNORE INTO ack_in
           (po_id, po_amount, po_message, po_datetime, ob_id, oa_id, ob_code, ob_datetime,
            cb_code, cb_datetime, bb_id, ba_id, bb_code, bb_datetime)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [ack.po_id, ack.po_amount, ack.po_message, ack.po_datetime,
         ack.ob_id, ack.oa_id, ack.ob_code||null, ack.ob_datetime||null,
         ack.cb_code||null, ack.cb_datetime||null,
         ack.bb_id, ack.ba_id, ack.bb_code||null, ack.bb_datetime||null]);
      // TX verwerken: update po_out met ACK-codes
      await pool.query(
        `UPDATE po_out SET cb_code = ?, cb_datetime = ?, bb_code = ?, bb_datetime = ?
         WHERE po_id = ?`,
        [ack.cb_code||null, ack.cb_datetime||null,
         ack.bb_code||null, ack.bb_datetime||null, ack.po_id]);

      if (String(ack.bb_code) === '2000') {
        // Geslaagd: transactie afsluiten
        await pool.query('UPDATE transactions SET iscomplete = 1 WHERE po_id = ?', [ack.po_id]);
      } else if (ack.bb_code) {
        // Mislukt: saldo betaler herstellen
        const [poRows] = await pool.query('SELECT oa_id, po_amount FROM po_out WHERE po_id = ?', [ack.po_id]);
        if (poRows.length) {
          await pool.query('UPDATE accounts SET balance = balance + ? WHERE id = ?',
            [poRows[0].po_amount, poRows[0].oa_id]);
          await pool.query('UPDATE transactions SET isvalid = 0, iscomplete = 1 WHERE po_id = ?', [ack.po_id]);
        }
      }

      await pool.query('INSERT INTO log (datetime, message, type, po_id) VALUES (?, ?, ?, ?)',
        [ts, `ACK ontvangen – TX ${String(ack.bb_code) === '2000' ? 'afgerond' : 'mislukt (saldo hersteld)'}`, 'ACK_IN', ack.po_id]);
    }
    return ok(res, acks, `${acks.length} ACK('s) ontvangen`);
  } catch (err) {
    return fail(res, 'SERVER_ERROR', err.message, 500);
  }
});

module.exports = router;
