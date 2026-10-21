const { Pool, types } = require('pg');

// PostgreSQL DATE values have no time zone. Keep them as YYYY-MM-DD strings
// so JSON serialization cannot shift the calendar day.
types.setTypeParser(types.builtins.DATE, (value) => value);
const isProduction = process.env.NODE_ENV === 'production';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});
module.exports = { pool };
