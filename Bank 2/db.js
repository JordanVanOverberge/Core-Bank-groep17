require('dotenv').config();
const mysql = require('mysql2/promise');
const fs    = require('fs');
const path  = require('path');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  multipleStatements: true,
});

async function initDb() {
  const conn = await pool.getConnection();
  const sql  = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await conn.query(sql);
  // Migrate existing tables: add isvalid/iscomplete if not yet present
  try { await conn.query('ALTER TABLE transactions ADD COLUMN isvalid TINYINT(1) NOT NULL DEFAULT 0'); } catch (_) {}
  try { await conn.query('ALTER TABLE transactions ADD COLUMN iscomplete TINYINT(1) NOT NULL DEFAULT 0'); } catch (_) {}
  conn.release();
  console.log('Database klaar (schema geladen)');
}

pool.initDb = initDb;
module.exports = pool;