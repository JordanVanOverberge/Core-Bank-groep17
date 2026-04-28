const express        = require('express');
const router         = express.Router();
const pool           = require('../db');
const { getCBToken } = require('../services/cbToken');

const ok   = (res, data, msg = 'OK', status = 200) =>
  res.status(status).json({ ok: true,  status, code: 2000,          message: msg, data });
const fail = (res, msg, status = 500, code = null) =>
  res.status(status).json({ ok: false, status, code: code ?? status * 10, message: msg, data: [] });

// GET /api/help
router.get('/help', (_req, res) => {
  ok(res, [
    { method: 'GET',  path: '/api/help',              auth: false, desc: 'Deze helplijst' },
    { method: 'GET',  path: '/api/info',              auth: false, desc: 'Bank info (BIC, naam, teamleden)' },
    { method: 'GET',  path: '/api/accounts',          auth: false, desc: 'Alle rekeningen' },
    { method: 'GET',  path: '/api/po_new_generate',   auth: false, desc: 'Willekeurige POs genereren – params: count, min, max' },
    { method: 'POST', path: '/api/po_new_add',        auth: false, desc: 'Manueel POs toevoegen aan po_new' },
    { method: 'GET',  path: '/api/po_new_process',    auth: false, desc: 'POs valideren en versturen naar CB' },
    { method: 'GET',  path: '/api/cb/poll_po',        auth: false, desc: 'Inkomende POs ophalen van CB en verwerken' },
    { method: 'GET',  path: '/api/cb/poll_ack',       auth: false, desc: 'Inkomende ACKs ophalen van CB' },
    { method: 'POST', path: '/api/po_in',             auth: true,  desc: 'POs ontvangen van andere bank (Bearer vereist)' },
    { method: 'GET',  path: '/api/po_out',            auth: false, desc: 'Inhoud po_out tabel' },
    { method: 'GET',  path: '/api/ack_out',           auth: false, desc: 'Inhoud ack_out tabel' },
    { method: 'GET',  path: '/api/ack_in',            auth: false, desc: 'Inhoud ack_in tabel' },
    { method: 'GET',  path: '/api/transactions',      auth: false, desc: 'Alle transacties' },
    { method: 'GET',  path: '/api/logs',              auth: false, desc: 'Alle logs (nieuwste eerst)' },
  ], 'CoreBank 2 (GKCCBEBB) – PingFin 2026 API');
});

// GET /api/info
router.get('/info', (_req, res) => {
  ok(res, {
    bic:     process.env.BIC,
    name:    process.env.BANK_NAME,
    cb_url:  process.env.CB_URL,
    members: ['Moussa Ismaël', 'Van Overberge Jordan', 'Boulhefa Anas', 'Bentatou Yasmina']
  }, 'Bank info');
});

// GET /api/accounts
router.get('/accounts', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM accounts');
    ok(res, rows, `${rows.length} rekening(en) gevonden`);
  } catch (err) {
    fail(res, err.message);
  }
});

// GET /api/token
router.get('/token', async (_req, res) => {
  try {
    const token = await getCBToken();
    ok(res, [{ token }], 'Token opgehaald');
  } catch (err) {
    fail(res, err.message);
  }
});

module.exports = router;
