const express        = require('express');
const router         = express.Router();
const pool           = require('../db');
const { getCBToken } = require('../services/cbToken');
const auth           = require('../middleware/auth');

const ok   = (res, data, msg = 'OK', status = 200) =>
  res.status(status).json({ ok: true,  status, code: 2000,          message: msg, data });
const fail = (res, msg, status = 500, code = null) =>
  res.status(status).json({ ok: false, status, code: code ?? status * 10, message: msg, data: [] });

const genId = () =>
  `${process.env.BIC}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
const now   = () =>
  new Date().toISOString().slice(0, 19).replace('T', ' ');

const MAX_AMOUNT = 500;

// CB error codes (pre-validation)
const CB_CODES = {
  4001: 'Interne betaling – niet naar CB sturen',
  4002: 'Bedrag is te hoog (max 500 euro)',
  4003: 'Bedrag is negatief of nul',
  4004: 'Ontvangende IBAN ongeldig (moet BE + 14 cijfers zijn)',
  4005: 'BIC ongeldig (moet 8 of 11 tekens zijn)',
  4006: 'PO_ID ongeldig (moet beginnen met eigen BIC)',
};

function localValidate(po) {
  if (po.po_amount <= 0)              return 4003;
  if (po.po_amount > MAX_AMOUNT)      return 4002;
  if (po.bb_id === process.env.BIC)   return 4001; // internal payment
  if (!/^BE\d{14}$/.test(po.ba_id))   return 4004; // invalid IBAN format
  if (po.bb_id.length !== 8 && po.bb_id.length !== 11) return 4005; // invalid BIC format
  if (!po.po_id.startsWith(process.env.BIC + '_')) return 4006; // invalid PO_ID
  return null;
}

// ─── GET /api/po_new_generate ─────────────────────────────────────────────────
// Query params: count (default 3), min (default 1), max (default 500)
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

    // Haal deelnemende banken op van CB (voor externe betalingen)
    let externalBanks = [];
    try {
      const token  = await getCBToken();
      const cbRes  = await fetch(`${process.env.CB_URL}/banks`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const cbData = await cbRes.json();
      externalBanks = (cbData.data || []).filter(b => b.bic !== process.env.BIC);
    } catch (_) { /* CB niet bereikbaar, enkel interne POs genereren */ }

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

    ok(res, generated, `${count} willekeurige PO('s) gegenereerd`);
  } catch (err) {
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
        [genId(), po.po_amount, po.po_message, now(),
         process.env.BIC, po.oa_id, po.bb_id, po.ba_id]
      );
    }
    ok(res, [], `${pos.length} PO('s) toegevoegd aan po_new`);
  } catch (err) {
    fail(res, err.message);
  }
});

// ─── GET /api/po_new_process ──────────────────────────────────────────────────
router.get('/po_new_process', async (_req, res) => {
  try {
    const [pos] = await pool.query('SELECT * FROM po_new');
    if (pos.length === 0) return ok(res, [], 'Geen POs om te verwerken');

    const internal = [];
    const external = [];
    const rejected = [];

    // Splits POs: interne betalingen, externe betalingen, en ongeldige
    for (const po of pos) {
      const errCode = localValidate(po);
      if (errCode === 4001) { internal.push(po); continue; }
      if (errCode)          { rejected.push({ po_id: po.po_id, code: errCode, reason: CB_CODES[errCode] }); continue; }
      external.push(po);
    }

    // --- Interne betalingen verwerken (geen CB nodig) ---
    for (const po of internal) {
      const ts = now();

      // Saldo-check: weiger als sender onvoldoende saldo heeft
      const [senderRows] = await pool.query(
        'SELECT balance FROM accounts WHERE id = ?', [po.oa_id]
      );
      if (!senderRows.length || senderRows[0].balance < po.po_amount) {
        rejected.push({
          po_id: po.po_id, code: 'INSUFFICIENT_FUNDS',
          reason: senderRows.length
            ? `Onvoldoende saldo (huidig: ${senderRows[0].balance}, gevraagd: ${po.po_amount})`
            : 'Zenderrekening niet gevonden'
        });
        await pool.query('DELETE FROM po_new WHERE po_id = ?', [po.po_id]);
        try {
          await pool.query(
            'INSERT INTO log (datetime, type, message, po_id) VALUES (?, ?, ?, ?)',
            [ts, 'po_rejected', 'Geweigerd: onvoldoende saldo', po.po_id]);
        } catch (_) {}
        continue;
      }

      await pool.query(
        `INSERT IGNORE INTO po_out (po_id, po_amount, po_message, po_datetime, ob_id, oa_id, bb_id, ba_id)
         SELECT po_id, po_amount, po_message, po_datetime, ob_id, oa_id, bb_id, ba_id
         FROM po_new WHERE po_id = ?`, [po.po_id]
      );
      await pool.query('DELETE FROM po_new WHERE po_id = ?', [po.po_id]);
      await pool.query(
        'UPDATE accounts SET balance = balance - ? WHERE id = ?', [po.po_amount, po.oa_id]);
      await pool.query(
        'UPDATE accounts SET balance = balance + ? WHERE id = ?', [po.po_amount, po.ba_id]);
      try {
        await pool.query(
          `INSERT INTO transactions (id, amount, datetime, po_id, account_id)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE id = id`,
          [`TXN_${po.po_id}`, po.po_amount, ts, po.po_id, po.ba_id]);
      } catch (_) {}
      try {
        await pool.query(
          'INSERT INTO log (datetime, type, message, po_id) VALUES (?, ?, ?, ?)',
          [ts, 'po_internal', 'Interne betaling verwerkt', po.po_id]);
      } catch (_) {}
    }

    // --- Ongeldige POs uit po_new verwijderen ---
    for (const r of rejected) {
      await pool.query('DELETE FROM po_new WHERE po_id = ?', [r.po_id]);
      try {
        await pool.query(
          'INSERT INTO log (datetime, type, message, po_id) VALUES (?, ?, ?, ?)',
          [now(), 'po_rejected', `Geweigerd (code ${r.code}): ${r.reason}`, r.po_id]);
      } catch (_) {}
    }

    // --- Externe POs naar CB sturen ---
    let cbResult = null;
    if (external.length > 0) {
      let token;
      try { token = await getCBToken(); }
      catch (e) { return fail(res, `CB token fout: ${e.message}`, 502, 5002); }

      // Verplaats POs naar po_out eerst
      for (const po of external) {
        const ts = now();
        await pool.query(
          `INSERT IGNORE INTO po_out (po_id, po_amount, po_message, po_datetime, ob_id, oa_id, bb_id, ba_id)
           SELECT po_id, po_amount, po_message, po_datetime, ob_id, oa_id, bb_id, ba_id
           FROM po_new WHERE po_id = ?`, [po.po_id]
        );
        await pool.query('DELETE FROM po_new WHERE po_id = ?', [po.po_id]);
        try {
          await pool.query(
            'INSERT INTO log (datetime, type, message, po_id) VALUES (?, ?, ?, ?)',
            [ts, 'po_out', 'PO klaar voor verzending naar CB', po.po_id]);
        } catch (_) {}
      }

      // Probeer naar CB te sturen
      try {
        const cbRes = await fetch(`${process.env.CB_URL}/po_in`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ data: external })
        });
        cbResult = await cbRes.json();
        if (!cbRes.ok) {
          // CB weigerde, maar POs zijn al in po_out
          for (const po of external) {
            try {
              await pool.query(
                'INSERT INTO log (datetime, type, message, po_id) VALUES (?, ?, ?, ?)',
                [now(), 'po_out', `CB weigerde PO: ${JSON.stringify(cbResult)}`, po.po_id]);
            } catch (_) {}
          }
          return fail(res, `CB weigerde POs: ${JSON.stringify(cbResult)}`, 502, 5002);
        }
        // Succes, update log
        for (const po of external) {
          try {
            await pool.query(
              'INSERT INTO log (datetime, type, message, po_id) VALUES (?, ?, ?, ?)',
              [now(), 'po_out', 'PO verstuurd naar CB', po.po_id]);
          } catch (_) {}
        }
      } catch (e) {
        // CB niet bereikbaar, POs blijven in po_out
        for (const po of external) {
          try {
            await pool.query(
              'INSERT INTO log (datetime, type, message, po_id) VALUES (?, ?, ?, ?)',
              [now(), 'po_out', 'CB niet bereikbaar - PO blijft in po_out', po.po_id]);
          } catch (_) {}
        }
        return fail(res, `CB niet bereikbaar: ${e.message}`, 502, 5002);
      }
    }

    ok(res, {
      internal: internal.length,
      external: external.length,
      rejected: rejected.length,
      rejected_details: rejected,
      cb_response: cbResult
    }, `Verwerkt: ${internal.length} intern, ${external.length} extern, ${rejected.length} geweigerd`);

  } catch (err) {
    fail(res, err.message);
  }
});

module.exports = router;
