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

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username === 'admin' && password === 'corebank123') {
    return res.json({ ok: true, data: { token: 'bank1_token_2026' } });
  }
  return res.status(401).json({ ok: false, status: 401, message: 'Ongeldige gebruikersnaam of wachtwoord' });
});

app.get('/api/help', (req, res) =>
  ok(res, [
    { method: 'GET',  path: '/api/help',              desc: 'Overzicht van alle beschikbare endpoints',                              auth: false },
    { method: 'GET',  path: '/api/info',              desc: 'Bank info: BIC, naam, teamleden',                                       auth: false },
    { method: 'GET',  path: '/api/accounts',          desc: 'Lijst van alle rekeningen met saldo',                                   auth: false },
    { method: 'POST', path: '/api/po_new_add',        desc: 'Nieuwe Payment Orders toevoegen aan PO_NEW',                            auth: false },
    { method: 'GET',  path: '/api/po_new_process',    desc: 'POs valideren en doorsturen naar CB',                                   auth: false },
    { method: 'GET',  path: '/api/po_out',            desc: 'Inhoud van PO_OUT tabel',                                               auth: false },
    { method: 'GET',  path: '/api/ack_out',           desc: 'ACKs ophalen van de CB',                                                auth: false },
    { method: 'GET',  path: '/api/ack_in',            desc: 'ACKs van CB opslaan in ack_in tabel',                                   auth: false },
    { method: 'GET',  path: '/api/token',             desc: 'Haalt een CB token op',                                                 auth: false },
    { method: 'GET',  path: '/api/po_new_generate',   desc: 'Genereert automatisch nieuwe POs via parameters: count, min, max',      auth: false },
    { method: 'GET',  path: '/api/cb/poll_po',        desc: 'Inkomende POs ophalen van CB en verwerken',                             auth: false },
    { method: 'GET',  path: '/api/cb/poll_ack',       desc: 'Inkomende ACKs ophalen van CB',                                         auth: false },
    { method: 'GET',  path: '/api/transactions',      desc: 'Alle transacties',                                                      auth: false },
    { method: 'GET',  path: '/api/logs',              desc: 'Alle logs',                                                             auth: false },
    { method: 'GET',  path: '/api/banks',             desc: 'Lijst van alle banken op het netwerk (via CB)',                          auth: false },
  ], 'API endpoints')
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

app.get('/api/banks', async (req, res) => {
  try {
    const banks = await cb.fetchBanks();
    return ok(res, banks.data ?? [], `${(banks.data ?? []).length} bank(en) gevonden`);
  } catch (err) {
    return fail(res, 'CB_ERROR', err.message);
  }
});

const PORT = process.env.PORT || 3000;
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Bank 1 server running on http://localhost:${PORT}`);
    console.log(`BIC: ${process.env.BANK_BIC}`);
    console.log(`CB:  ${process.env.CB_URL}`);
  });

  // Timeout: mark pending TXs older than 5 minutes as invalid+complete
  const nowStr = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
  setInterval(async () => {
    try {
      const [result] = await pool.query(
        `UPDATE transactions SET isvalid=0, iscomplete=1
         WHERE iscomplete=0 AND datetime < DATE_SUB(NOW(), INTERVAL 5 MINUTE)`
      );
      if (result.affectedRows > 0) {
        await pool.query(
          'INSERT INTO log (datetime, type, message) VALUES (?, ?, ?)',
          [nowStr(), 'timeout', `${result.affectedRows} transactie(s) verlopen door timeout`]
        );
        console.log(`[timeout] ${result.affectedRows} pending transaction(s) timed out`);
      }
    } catch (err) {
      console.error('[timeout] Fout bij timeout check:', err.message);
    }
  }, 60_000);
}).catch(err => {
  console.error('Failed to initialize database:', err.message);
  process.exit(1);
});
