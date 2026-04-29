// CB polling routes – ophalen van inkomende POs en ACKs van de Clearing Bank.
// CB verwijdert records na één ophaling ("retrieved only once before removal").
const express        = require('express');
const router         = express.Router();
const pool           = require('../db');
const { getCBToken } = require('../services/cbToken');

const ok   = (res, data, msg = 'OK', status = 200) =>
  res.status(status).json({ ok: true,  status, code: 2000,          message: msg, data });
const fail = (res, msg, status = 500, code = null) =>
  res.status(status).json({ ok: false, status, code: code ?? status * 10, message: msg, data: [] });

const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

// ─── GET /api/cb/poll_po ──────────────────────────────────────────────────────
// Haal inkomende POs op van CB, sla op in po_in, crediteer rekeningen, stuur ACK terug
router.get('/cb/poll_po', async (_req, res) => {
  let token;
  try { token = await getCBToken(); }
  catch (e) { return fail(res, `CB token fout: ${e.message}`, 502, 5002); }

  let incomingPos;
  try {
    const cbRes   = await fetch(`${process.env.CB_URL}/po_out`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const cbData  = await cbRes.json();
    if (!cbRes.ok) return fail(res, `CB fout: ${JSON.stringify(cbData)}`, 502, 5002);
    incomingPos = cbData.data ?? [];
  } catch (e) {
    return fail(res, `CB niet bereikbaar: ${e.message}`, 502, 5002);
  }

  if (incomingPos.length === 0) return ok(res, [], 'Geen nieuwe POs van CB');

  const acks = [];
  for (const po of incomingPos) {
    const ts = now();

    // Sla op in po_in
    try {
      await pool.query(
        `INSERT INTO po_in (po_id, po_amount, po_message, po_datetime, ob_id, oa_id, bb_id, ba_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE po_id = po_id`,
        [po.po_id, po.po_amount, po.po_message, po.po_datetime,
         po.ob_id, po.oa_id, po.bb_id, po.ba_id]
      );
    } catch (_) {}

    // Crediteer ontvangende rekening en registreer transactie (enkel bij geldig account)
    let bb_code = 2000;
    try {
      const [accts] = await pool.query('SELECT id FROM accounts WHERE id = ?', [po.ba_id]);
      if (accts.length === 0) {
        bb_code = 4004;
      } else {
        await pool.query(
          'UPDATE accounts SET balance = balance + ? WHERE id = ?',
          [po.po_amount, po.ba_id]
        );
        await pool.query(
          `INSERT INTO transactions (id, amount, datetime, po_id, account_id)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE id = id`,
          [`TXN_${po.po_id}`, po.po_amount, ts, po.po_id, po.ba_id]
        );
      }
    } catch (_) {}

    // Bouw ACK op
    const ack = {
      po_id: po.po_id, po_amount: po.po_amount, po_message: po.po_message,
      po_datetime: po.po_datetime,
      ob_id: po.ob_id, oa_id: po.oa_id, ob_code: po.ob_code ?? null, ob_datetime: po.ob_datetime ?? null,
      cb_code: po.cb_code ?? null, cb_datetime: po.cb_datetime ?? null,
      bb_id: process.env.BIC, ba_id: po.ba_id, bb_code, bb_datetime: ts
    };

    // Sla ACK op in ack_out
    try {
      await pool.query(
        `INSERT INTO ack_out
           (po_id, po_amount, po_message, po_datetime,
            ob_id, oa_id, ob_code, ob_datetime,
            cb_code, cb_datetime,
            bb_id, ba_id, bb_code, bb_datetime)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE po_id = po_id`,
        [ack.po_id, ack.po_amount, ack.po_message, ack.po_datetime,
         ack.ob_id, ack.oa_id, ack.ob_code, ack.ob_datetime,
         ack.cb_code, ack.cb_datetime,
         ack.bb_id, ack.ba_id, ack.bb_code, ack.bb_datetime]
      );
    } catch (_) {}

    try {
      await pool.query(
        'INSERT INTO log (datetime, type, message, po_id) VALUES (?, ?, ?, ?)',
        [ts, 'po_in', 'PO ontvangen van CB', po.po_id]
      );
    } catch (_) {}

    acks.push(ack);
  }

  // Stuur ACKs terug naar CB
  try {
    await fetch(`${process.env.CB_URL}/ack_in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ data: acks })
    });
  } catch (_) { /* ACK sturen mislukt – lokaal al opgeslagen */ }

  ok(res, acks, `${incomingPos.length} PO('s) ontvangen van CB en verwerkt`);
});

// ─── GET /api/cb/poll_ack ─────────────────────────────────────────────────────
// Haal inkomende ACKs op van CB (voor onze verstuurde POs) en sla op in ack_in
router.get('/cb/poll_ack', async (_req, res) => {
  let token;
  try { token = await getCBToken(); }
  catch (e) { return fail(res, `CB token fout: ${e.message}`, 502, 5002); }

  let incomingAcks;
  try {
    const cbRes  = await fetch(`${process.env.CB_URL}/ack_out`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const cbData = await cbRes.json();
    if (!cbRes.ok) return fail(res, `CB fout: ${JSON.stringify(cbData)}`, 502, 5002);
    incomingAcks = cbData.data ?? [];
  } catch (e) {
    return fail(res, `CB niet bereikbaar: ${e.message}`, 502, 5002);
  }

  if (incomingAcks.length === 0) return ok(res, [], 'Geen nieuwe ACKs van CB');

  for (const ack of incomingAcks) {
    const ts = now();
    try {
      await pool.query(
        `INSERT INTO ack_in
           (po_id, po_amount, po_message, po_datetime,
            ob_id, oa_id, ob_code, ob_datetime,
            cb_code, cb_datetime,
            bb_id, ba_id, bb_code, bb_datetime)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE po_id = po_id`,
        [ack.po_id, ack.po_amount, ack.po_message, ack.po_datetime,
         ack.ob_id, ack.oa_id, ack.ob_code, ack.ob_datetime,
         ack.cb_code, ack.cb_datetime,
         ack.bb_id, ack.ba_id, ack.bb_code, ack.bb_datetime]
      );
    } catch (_) {}
    if (String(ack.bb_code) === '2000') {
      try {
        await pool.query(
          'UPDATE accounts SET balance = balance - ? WHERE id = ?',
          [ack.po_amount, ack.oa_id]);
        await pool.query(
          `INSERT INTO transactions (id, amount, datetime, po_id, account_id)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE id = id`,
          [`TXN_DEBIT_${ack.po_id}`, ack.po_amount, ts, ack.po_id, ack.oa_id]);
      } catch (_) {}
    }
    try {
      await pool.query(
        'INSERT INTO log (datetime, type, message, po_id) VALUES (?, ?, ?, ?)',
        [ts, 'ack_in', 'ACK ontvangen van CB', ack.po_id]
      );
    } catch (_) {}
  }

  ok(res, incomingAcks, `${incomingAcks.length} ACK('s) ontvangen van CB`);
});

module.exports = router;
