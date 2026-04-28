require('dotenv').config();
const express = require('express');
const path    = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', require('./routes/public'));
app.use('/api', require('./routes/po'));
app.use('/api', require('./routes/po_in'));
app.use('/api', require('./routes/cb_poll'));
app.use('/api', require('./routes/data'));

app.get('/', (req, res) => res.redirect('/api/help'));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`CoreBank 2 (GKCCBEBB) API draait op http://localhost:${PORT}`);
  console.log(`  → http://localhost:${PORT}/api/help`);
});
