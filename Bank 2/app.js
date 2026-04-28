require('dotenv').config();
const express = require('express');
const path    = require('path');

const app = express();
app.use(express.json());
 
app.use('/api', require('./routes/public'));
app.use('/api', require('./routes/po'));
app.use('/api', require('./routes/po_in'));
app.use('/api', require('./routes/cb_poll'));
app.use('/api', require('./routes/data'));
 
const PORT = process.env.PORT || 3001;
pool.initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Bank 2 server running on http://localhost:${PORT}`);
    console.log(`BIC: ${process.env.BIC}`);
    console.log(`CB:  ${process.env.CB_URL}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err.message);
  process.exit(1);
});