require('dotenv').config();
const express = require('express');
const path    = require('path');
const pool    = require('./db');
const notifs  = require('./notifications');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', require('./routes/public'));
app.use('/api', require('./routes/po'));
app.use('/api', require('./routes/po_in'));
app.use('/api', require('./routes/cb_poll'));
app.use('/api', require('./routes/data'));

app.get('/api/notifications', (_req, res) => {
  res.json({ ok: true, data: notifs.getAll(), unread: notifs.unreadCount() });
});
app.post('/api/notifications/read', (_req, res) => {
  notifs.markRead();
  res.json({ ok: true });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username === 'admin' && password === 'Pingfin2026!') {
    return res.json({ ok: true, data: { token: 'gkccbebb_token_2026' } });
  }
  return res.status(401).json({ ok: false, status: 401 });
});

app.get('/', (req, res) => res.redirect('/index.html'));

const PORT = process.env.PORT || 3001;
pool.initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Bank 2 server running on http://localhost:${PORT}`);
    console.log(`BIC: ${process.env.BIC}`);
    console.log(`CB:  ${process.env.CB_URL}`);
  });

  // Timeout: refund reserved amounts and mark pending TXs older than 5 minutes as invalid
  const nowStr = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
  setInterval(async () => {
    try {
      const [pendingTxs] = await pool.query(
        `SELECT id, amount, account_id FROM transactions
         WHERE iscomplete=0 AND datetime < DATE_SUB(NOW(), INTERVAL 5 MINUTE)`
      );
      if (pendingTxs.length > 0) {
        for (const tx of pendingTxs) {
          await pool.query(
            'UPDATE accounts SET balance = balance + ? WHERE id = ?',
            [tx.amount, tx.account_id]
          );
        }
        const ids = pendingTxs.map(tx => tx.id);
        await pool.query(
          `UPDATE transactions SET isvalid=0, iscomplete=1 WHERE id IN (?)`, [ids]
        );
        await pool.query(
          'INSERT INTO log (datetime, type, message) VALUES (?, ?, ?)',
          [nowStr(), 'timeout', `${pendingTxs.length} transactie(s) verlopen door timeout (geld teruggestort)`]
        );
        console.log(`[timeout] ${pendingTxs.length} pending transaction(s) timed out, amounts refunded`);
      }
    } catch (err) {
      console.error('[timeout] Fout bij timeout check:', err.message);
    }
  }, 60_000);
}).catch(err => {
  console.error('Failed to initialize database:', err.message);
  process.exit(1);
});
