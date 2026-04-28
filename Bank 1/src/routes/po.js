const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const cb = require('../middleware/cbApi');

const BIC = () => process.env.BANK_BIC;
const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

const ok = (res, data = null, message = null, status = 200) =>
  res.status(status).json({ ok: true, status, code: 2000, message, data });

const fail = (res, code, message, status = 400) =>
  res.status(status).json({ ok: false, status, code, message, data: null });

// POST /api/po — create new outgoing PO (OB flow)
router.post('/', async (req, res) => {
  try {
    const { po_amount, po_message, bb_id, oa_id, ba_id } = req.body;

    if (!po_amount || po_amount <= 0)
      return fail(res, 4003, 'Bedrag moet groter zijn dan 0');
    if (po_amount > 500)
      return fail(res, 4002, 'Bedrag mag niet hoger zijn dan 500 euro');
    if (bb_id === BIC())
      return fail(res, 4001, 'Interne betalingen mogen niet naar de CB worden gestuurd');

    const po_id = `${BIC()}_${Date.now()}`;
    const po_datetime = now();
    const ob_code = 2000;
    const ob_datetime = now();

    const [account] = await pool.query('SELECT * FROM accounts WHERE id = ?', [oa_id]);
    if (!account.length)
      return fail(res, 'ACCOUNT_NOT_FOUND', `Rekening ${oa_id} niet gevonden`);
    if (account[0].balance < po_amount)
      return fail(res, 'INSUFFICIENT_FUNDS', 'Onvoldoende saldo');

    const po = { po_id, po_amount, po_message, po_datetime, ob_id: BIC(), oa_id, ob_code, ob_datetime, bb_id, ba_id };

    await pool.query(
      `INSERT INTO po_new (po_id, po_amount, po_message, po_datetime, ob_id, oa_id, ob_code, ob_datetime, bb_id, ba_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [po.po_id, po.po_amount, po.po_message, po.po_datetime, po.ob_id, po.oa_id, po.ob_code, po.ob_datetime, po.bb_id, po.ba_id]
    );

    const cbResponse = await cb.sendPoToCb([po]);

    await pool.query(
      `INSERT INTO po_out (po_id, po_amount, po_message, po_datetime, ob_id, oa_id, ob_code, ob_datetime, bb_id, ba_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [po.po_id, po.po_amount, po.po_message, po.po_datetime, po.ob_id, po.oa_id, po.ob_code, po.ob_datetime, po.bb_id, po.ba_id]
    );

    await pool.query('UPDATE accounts SET balance = balance - ? WHERE id = ?', [po_amount, oa_id]);

    await pool.query(
      `INSERT INTO log (datetime, message, type, po_id, po_amount, po_message, po_datetime, ob_id, oa_id, ob_code, ob_datetime, bb_id, ba_id)
       VALUES (?, 'PO aangemaakt en verstuurd naar CB', 'PO_OUT', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [now(), po.po_id, po.po_amount, po.po_message, po.po_datetime, po.ob_id, po.oa_id, po.ob_code, po.ob_datetime, po.bb_id, po.ba_id]
    );

    return ok(res, [po], `PO ${po_id} verstuurd naar CB`, 201);
  } catch (err) {
    return fail(res, 'SERVER_ERROR', err.message, 500);
  }
});

// GET /api/po — list own outgoing POs
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM po_new ORDER BY po_datetime DESC');
    return ok(res, rows, `${rows.length} PO(s) gevonden`);
  } catch (err) {
    return fail(res, 'SERVER_ERROR', err.message, 500);
  }
});

// GET /api/po/incoming — fetch and process incoming POs from CB (BB flow)
router.get('/incoming', async (req, res) => {
  try {
    const data = await cb.fetchPoFromCb();
    const pos = data.data || [];

    for (const po of pos) {
      const [account] = await pool.query('SELECT * FROM accounts WHERE id = ?', [po.ba_id]);
      const isvalid = account.length > 0 && po.po_amount > 0 ? 1 : 0;
      const bb_code = isvalid ? 2000 : 4004;
      const bb_datetime = now();

      await pool.query(
        `INSERT IGNORE INTO po_in (po_id, po_amount, po_message, po_datetime, ob_id, oa_id, ob_code, ob_datetime, cb_code, cb_datetime, bb_id, ba_id, bb_code, bb_datetime)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [po.po_id, po.po_amount, po.po_message, po.po_datetime, po.ob_id, po.oa_id, po.ob_code||null, po.ob_datetime||null, po.cb_code||null, po.cb_datetime||null, po.bb_id, po.ba_id, bb_code, bb_datetime]
      );

      if (isvalid) {
        await pool.query('UPDATE accounts SET balance = balance + ? WHERE id = ?', [po.po_amount, po.ba_id]);
        await pool.query(
          `INSERT IGNORE INTO transactions (id, amount, datetime, po_id, account_id, isvalid, iscomplete)
           VALUES (?, ?, ?, ?, ?, 1, 1)`,
          [`TXN_${po.po_id}`, po.po_amount, now(), po.po_id, po.ba_id]
        );
      }

      await pool.query(
        `INSERT IGNORE INTO ack_out (po_id, po_amount, po_message, po_datetime, ob_id, oa_id, ob_code, ob_datetime, cb_code, cb_datetime, bb_id, ba_id, bb_code, bb_datetime)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [po.po_id, po.po_amount, po.po_message, po.po_datetime, po.ob_id, po.oa_id, po.ob_code||null, po.ob_datetime||null, po.cb_code||null, po.cb_datetime||null, po.bb_id, po.ba_id, bb_code, bb_datetime]
      );

      await pool.query(
        `INSERT INTO log (datetime, message, type, po_id, po_amount, bb_id, ba_id) VALUES (?, ?, 'PO_IN', ?, ?, ?, ?)`,
        [now(), isvalid ? 'Inkomende PO verwerkt' : 'Inkomende PO geweigerd', po.po_id, po.po_amount, po.bb_id, po.ba_id]
      );
    }

    if (pos.length > 0) {
      const [acks] = await pool.query(`SELECT * FROM ack_out WHERE po_id IN (?)`, [pos.map(p => p.po_id)]);
      await cb.sendAckIn(acks);
    }

    return ok(res, pos, `${pos.length} inkomende PO(s) verwerkt`);
  } catch (err) {
    return fail(res, 'SERVER_ERROR', err.message, 500);
  }
});

// GET /api/po/ack — fetch ACKs from CB for sent POs
router.get('/ack', async (req, res) => {
  try {
    const data = await cb.fetchAckOut();
    const acks = data.data || [];
    for (const ack of acks) {
      await pool.query(
        `INSERT IGNORE INTO ack_in (po_id, po_amount, po_message, po_datetime, ob_id, oa_id, ob_code, ob_datetime, cb_code, cb_datetime, bb_id, ba_id, bb_code, bb_datetime)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [ack.po_id, ack.po_amount, ack.po_message, ack.po_datetime, ack.ob_id, ack.oa_id, ack.ob_code||null, ack.ob_datetime||null, ack.cb_code||null, ack.cb_datetime||null, ack.bb_id, ack.ba_id, ack.bb_code||null, ack.bb_datetime||null]
      );
      await pool.query(
        `INSERT INTO log (datetime, message, type, po_id) VALUES (?, 'ACK ontvangen van CB', 'ACK_IN', ?)`,
        [now(), ack.po_id]
      );
    }
    return ok(res, acks, `${acks.length} ACK(s) ontvangen`);
  } catch (err) {
    return fail(res, 'SERVER_ERROR', err.message, 500);
  }
});

module.exports = router;
