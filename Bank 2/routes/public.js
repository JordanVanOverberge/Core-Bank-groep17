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
    { method: 'GET',  path: '/api/help',              desc: 'Overzicht van alle beschikbare endpoints',                              auth: false },
    { method: 'GET',  path: '/api/info',              desc: 'Bank info: BIC, naam, teamleden',                                       auth: false },
    { method: 'GET',  path: '/api/accounts',          desc: 'Lijst van alle rekeningen met saldo',                                   auth: false },
    { method: 'POST', path: '/api/po_new_add',        desc: 'Nieuwe Payment Orders toevoegen aan PO_NEW',                            auth: false },
    { method: 'GET',  path: '/api/po_new_process',    desc: 'POs valideren en doorsturen naar CB',                                   auth: true  },
    { method: 'GET',  path: '/api/po_out',            desc: 'Inhoud van PO_OUT tabel',                                               auth: false },
    { method: 'GET',  path: '/api/ack_out',           desc: 'ACKs ophalen van de CB',                                                auth: false },
    { method: 'GET',  path: '/api/ack_in',            desc: 'ACKs van CB opslaan in ack_in tabel',                                   auth: false },
    { method: 'GET',  path: '/api/token',             desc: 'Haalt een CB token op',                                                 auth: false },
    { method: 'GET',  path: '/api/po_new_generate',   desc: 'Genereert automatisch nieuwe POs via parameters: count, min, max',      auth: false },
    { method: 'GET',  path: '/api/cb/poll_po',        desc: 'Inkomende POs ophalen van CB en verwerken',                             auth: false },
    { method: 'GET',  path: '/api/cb/poll_ack',       desc: 'Inkomende ACKs ophalen van CB',                                         auth: false },
    { method: 'GET',  path: '/api/transactions',      desc: 'Alle transacties',                                                      auth: false },
    { method: 'GET',  path: '/api/logs',              desc: 'Alle logs',                                                             auth: false },
  ], 'API endpoints');
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
