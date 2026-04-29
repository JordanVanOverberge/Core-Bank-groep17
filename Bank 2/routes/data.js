const express = require('express');
const router  = express.Router();
const pool    = require('../db');

const ok   = (res, data, msg = 'OK', status = 200) =>
  res.status(status).json({ ok: true,  status, code: 2000,          message: msg, data });
const fail = (res, msg, status = 500, code = null) =>
  res.status(status).json({ ok: false, status, code: code ?? status * 10, message: msg, data: [] });

// GET /api/po_new
router.get('/po_new', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM po_new ORDER BY po_datetime DESC');
    ok(res, rows, `${rows.length} PO('s) in wachtrij`);
  } catch (err) { fail(res, err.message); }
});

// GET /api/po_in
router.get('/po_in', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM po_in ORDER BY po_datetime DESC');
    ok(res, rows, `${rows.length} ontvangen PO('s)`);
  } catch (err) { fail(res, err.message); }
});

// GET /api/transactions
router.get('/transactions', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM transactions');
    ok(res, rows, `${rows.length} transactie(s) gevonden`);
  } catch (err) {
    fail(res, err.message);
  }
});

// GET /api/logs
router.get('/logs', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM log ORDER BY datetime DESC');
    ok(res, rows, `${rows.length} log(s) gevonden`);
  } catch (err) {
    fail(res, err.message);
  }
});

// GET /api/po_out
router.get('/po_out', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM po_out');
    ok(res, rows, `${rows.length} PO('s) gevonden in po_out`);
  } catch (err) {
    fail(res, err.message);
  }
});

// GET /api/ack_in
router.get('/ack_in', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM ack_in');
    ok(res, rows, `${rows.length} ACK('s) gevonden in ack_in`);
  } catch (err) {
    fail(res, err.message);
  }
});

module.exports = router;
