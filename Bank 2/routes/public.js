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
  res.redirect('https://spotty-divan-1b9.notion.site/PingFin-API-Documentation-GKCCBEBB-350f0625fdc2807d97dfcca8b8dd1561');
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
