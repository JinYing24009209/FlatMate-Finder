require('dotenv').config();
const { pool } = require('../src/config/database');

async function main() {
  const {
    rows: [row],
  } = await pool.query(
    `
      SELECT setval(
        pg_get_serial_sequence('listing_photo', 'photo_id'),
        GREATEST(COALESCE((SELECT MAX(photo_id) FROM listing_photo), 1), 1),
        true
      ) AS value
    `
  );
  console.log(`listing_photo sequence aligned to ${row.value}.`);
  await pool.end();
}

main().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
