require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/database');

async function migrate() {
  const migrationPath = path.join(__dirname, '..', '..', 'database', 'upgrade.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');
  await pool.query(sql);
  await pool.query(fs.readFileSync(path.join(__dirname, '..', '..', 'database', 'community-upgrade.sql'), 'utf8'));
  await pool.query(fs.readFileSync(path.join(__dirname, '..', '..', 'database', 'outcomes-upgrade.sql'), 'utf8'));
  await pool.query(fs.readFileSync(path.join(__dirname, '..', '..', 'database', 'moderation-upgrade.sql'), 'utf8'));
  console.log('Database upgrade completed, including agreements, payments and moderation actions.');
  await pool.end();
}

migrate().catch(async (error) => {
  console.error(`Database upgrade failed: ${error.message}`);
  await pool.end().catch(() => {});
  process.exit(1);
});
