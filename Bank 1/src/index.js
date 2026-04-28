require('dotenv').config();
const express = require('express');
const path = require('path');
const { initDb } = require('./db');
const poRoutes = require('./routes/po');
const cb = require('./middleware/cbApi');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const ok = (res, data = null, message = null, status = 200) =>
  res.status(status).json({ ok: true, status, code: null, message, data });

const fail = (res, code, message, status = 500) =>
  res.status(status).json({ ok: false, status, code, message, data: null });

app.use('/api/po', poRoutes);

app.get('/', (req, res) => res.redirect('/api/help'));

app.get('/api/help', (req, res) => {
  return ok(res, [
    { method: 'GET',  url: '/api/help',       description: 'This help page' },
    { method: 'GET',  url: '/api/token',       description: 'Get a fresh CB auth token' },
    { method: 'GET',  url: '/api/accounts',    description: 'List all accounts' },
    { method: 'GET',  url: '/api/log',         description: 'Last 100 log entries' },
    { method: 'POST', url: '/api/po',          description: 'Create and send a PO to CB (OB flow)' },
    { method: 'GET',  url: '/api/po',          description: 'List own outgoing POs' },
    { method: 'GET',  url: '/api/po/incoming', description: 'Fetch and process incoming POs from CB (BB flow)' },
    { method: 'GET',  url: '/api/po/ack',      description: 'Fetch ACKs for sent POs from CB' },
  ], `PingFin Bank — BIC: ${process.env.BANK_BIC}`);
});

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
    const { pool } = require('./db');
    const [rows] = await pool.query('SELECT * FROM accounts ORDER BY id');
    return ok(res, rows, `${rows.length} rekening(en) gevonden`);
  } catch (err) {
    return fail(res, 'DB_ERROR', err.message);
  }
});

app.get('/api/log', async (req, res) => {
  try {
    const { pool } = require('./db');
    const [rows] = await pool.query('SELECT * FROM log ORDER BY datetime DESC LIMIT 100');
    return ok(res, rows, `${rows.length} log entries`);
  } catch (err) {
    return fail(res, 'DB_ERROR', err.message);
  }
});

const PORT = process.env.PORT || 3000;
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Bank server running on http://localhost:${PORT}`);
    console.log(`BIC: ${process.env.BANK_BIC}`);
    console.log(`CB:  ${process.env.CB_URL}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err.message);
  process.exit(1);
});
