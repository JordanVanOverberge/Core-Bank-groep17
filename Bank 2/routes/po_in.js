const express = require('express');
const router  = express.Router();
const pool    = require('../db');
const auth    = require('../middleware/auth');

const ok   = (res, data, msg = 'OK', status = 200) =>
  res.status(status).json({ ok: true,  status, code: 2000,          message: msg, data });
const fail = (res, msg, status = 500, code = null) =>
  res.status(status).json({ ok: false, status, code: code ?? status * 10, message: msg, data: [] });

const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

// POST /api/po_in  –  CB stuurt ons POs toe (van andere banken)
router.post('/po_in', auth, async (req, res) => {
  const pos = req.body?.data;
  if (!Array.isArray(pos) || pos.length === 0)
    return fail(res, 'Geen PO data ontvangen', 400, 4000);

  try {
    const acks = [];

    for (const po of pos) {
      const ts = now();

      // Sla PO op in po_in
      await pool.query(
        `INSERT INTO po_in (po_id, po_amount, po_message, po_datetime, ob_id, oa_id, bb_id, ba_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE po_id = po_id`,
        [po.po_id, po.po_amount, po.po_message, po.po_datetime,
         po.ob_id, po.oa_id, po.bb_id, po.ba_id]
      );

      // Crediteer de ontvangende rekening
      try {
        await pool.query(
          'UPDATE accounts SET balance = balance + ? WHERE id = ?',
          [po.po_amount, po.ba_id]
        );
      } catch (_) {}

      // Bouw ACK op en sla op in ack_out
      const ack = {
        po_id: po.po_id, po_amount: po.po_amount, po_message: po.po_message,
        po_datetime: po.po_datetime,
        ob_id: po.ob_id, oa_id: po.oa_id, ob_code: null, ob_datetime: null,
        cb_code: po.cb_code ?? null, cb_datetime: po.cb_datetime ?? null,
        bb_id: process.env.BIC, ba_id: po.ba_id, bb_code: 'OK', bb_datetime: ts
      };

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

      try {
        await pool.query(
          'INSERT INTO log (datetime, type, message, po_id) VALUES (?, ?, ?, ?)',
          [ts, 'po_in', 'PO ontvangen van CB', po.po_id]
        );
      } catch (_) {}

      acks.push(ack);
    }

    ok(res, acks, `${pos.length} PO('s) ontvangen en verwerkt`);
  } catch (err) {
    fail(res, err.message);
  }
});

// GET /api/ack_out
router.get('/ack_out', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM ack_out');
    ok(res, rows, `${rows.length} ACK('s) gevonden in ack_out`);
  } catch (err) {
    fail(res, err.message);
  }
});

module.exports = router;
