require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/database');

async function migrate() {
  const migrationPath = path.join(__dirname, '..', '..', 'database', 'upgrade.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');
  await pool.query(sql);
  console.log('Database upgrade v6 completed.');
  await pool.end();
}

migrate().catch(async (error) => {
  console.error(`Database upgrade v6 failed: ${error.message}`);
  await pool.end().catch(() => {});
  process.exit(1);
});
