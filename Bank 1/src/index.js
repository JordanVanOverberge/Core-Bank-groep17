require('dotenv').config();
const express = require('express');
const path    = require('path');
const { initDb, pool } = require('./db');
const poRoutes = require('./routes/po');
const cb = require('./middleware/cbApi');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const ok   = (res, data = null, msg = null, status = 200) =>
  res.status(status).json({ ok: true,  status, code: 2000, message: msg, data });
const fail = (res, code, msg, status = 500) =>
  res.status(status).json({ ok: false, status, code, message: msg, data: null });

app.use('/api', poRoutes);

app.get('/', (req, res) => res.redirect('/api/help'));

app.get('/api/help', (req, res) =>
  ok(res, [
    { method: 'GET',  path: '/api/help',            auth: false, desc: 'Overzicht van alle endpoints' },
    { method: 'GET',  path: '/api/info',            auth: false, desc: 'Bank info (BIC, naam, teamleden)' },
    { method: 'GET',  path: '/api/token',           auth: false, desc: 'Vers CB auth token ophalen' },
    { method: 'GET',  path: '/api/accounts',        auth: false, desc: 'Alle rekeningen' },
    { method: 'GET',  path: '/api/po_new_generate', auth: false, desc: 'Willekeurige POs genereren – params: count, min, max' },
    { method: 'POST', path: '/api/po_new_add',      auth: false, desc: 'POs toevoegen aan po_new wachtrij' },
    { method: 'GET',  path: '/api/po_new_process',  auth: false, desc: 'POs valideren en versturen naar CB' },
    { method: 'GET',  path: '/api/cb/poll_po',      auth: false, desc: 'Inkomende POs ophalen van CB en verwerken (BB flow)' },
    { method: 'GET',  path: '/api/cb/poll_ack',     auth: false, desc: 'ACKs ophalen van CB voor verstuurde POs' },
    { method: 'GET',  path: '/api/po_out',          auth: false, desc: 'Inhoud po_out tabel' },
    { method: 'GET',  path: '/api/ack_in',          auth: false, desc: 'Inhoud ack_in tabel' },
    { method: 'GET',  path: '/api/ack_out',         auth: false, desc: 'Inhoud ack_out tabel' },
    { method: 'GET',  path: '/api/transactions',    auth: false, desc: 'Alle transacties' },
    { method: 'GET',  path: '/api/logs',            auth: false, desc: 'Alle logs (nieuwste eerst)' },
  ], `PingFin Bank 1 — BIC: ${process.env.BANK_BIC}`)
);

app.get('/api/info', (req, res) =>
  ok(res, {
    bic:     process.env.BANK_BIC,
    name:    process.env.BANK_NAME,
    cb_url:  process.env.CB_URL,
    members: ['Moussa Ismaël', 'Van Overberge Jordan', 'Boulhefa Anas', 'Bentatou Yasmina'],
  }, 'Bank info')
);

app.get('/api/token', async (req, res) => {
  try {
    const token = await cb.getToken();
    return ok(res, [{ token }], 'Token opgehaald');
  } catch (err) {
    return fail(res, 'TOKEN_ERROR', err.message);
  }
});

app.get('/api/accounts', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM accounts ORDER BY id');
    return ok(res, rows, `${rows.length} rekening(en) gevonden`);
  } catch (err) {
    return fail(res, 'DB_ERROR', err.message);
  }
});

app.get('/api/po_out', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM po_out ORDER BY po_datetime DESC');
    return ok(res, rows, `${rows.length} PO('s) gevonden in po_out`);
  } catch (err) {
    return fail(res, 'DB_ERROR', err.message);
  }
});

app.get('/api/ack_in', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM ack_in ORDER BY ob_datetime DESC');
    return ok(res, rows, `${rows.length} ACK('s) gevonden in ack_in`);
  } catch (err) {
    return fail(res, 'DB_ERROR', err.message);
  }
});

app.get('/api/ack_out', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM ack_out ORDER BY bb_datetime DESC');
    return ok(res, rows, `${rows.length} ACK('s) gevonden in ack_out`);
  } catch (err) {
    return fail(res, 'DB_ERROR', err.message);
  }
});

app.get('/api/transactions', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM transactions ORDER BY datetime DESC');
    return ok(res, rows, `${rows.length} transactie(s) gevonden`);
  } catch (err) {
    return fail(res, 'DB_ERROR', err.message);
  }
});

app.get('/api/logs', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM log ORDER BY datetime DESC LIMIT 100');
    return ok(res, rows, `${rows.length} log entries`);
  } catch (err) {
    return fail(res, 'DB_ERROR', err.message);
  }
});

const PORT = process.env.PORT || 3000;
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Bank 1 server running on http://localhost:${PORT}`);
    console.log(`BIC: ${process.env.BANK_BIC}`);
    console.log(`CB:  ${process.env.CB_URL}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err.message);
  process.exit(1);
});
