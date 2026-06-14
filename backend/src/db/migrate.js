'use strict';
// Applies schema.sql. Idempotent — safe to run repeatedly.
const fs = require('fs');
const path = require('path');
const { pool } = require('./pool');

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  console.log('Applying schema...');
  await pool.query(sql);
  console.log('✓ Schema applied.');
  await pool.end();
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
