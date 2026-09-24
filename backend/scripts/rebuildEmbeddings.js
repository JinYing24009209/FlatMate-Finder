require('dotenv').config();

const { pool } = require('../src/config/database');
const { getAiProviderStatus, storeListingEmbedding } = require('../src/services/aiService');

async function rebuild() {
  const status = getAiProviderStatus();
  if (!status.configured)
    throw new Error('Configure GEMINI_API_KEY or OPENAI_API_KEY before rebuilding embeddings.');

  const { rows } = await pool.query(
    `
      SELECT listing_id, title, description, city, room_type, house_rules
      FROM listing
      WHERE status = 'available'
      ORDER BY listing_id
    `
  );

  let completed = 0;
  for (const listing of rows) {
    const vector = await storeListingEmbedding(pool, listing);
    if (vector) completed += 1;
  }

  console.log(`Stored ${completed} of ${rows.length} listing embeddings using ${status.mode}.`);
  await pool.end();
}

rebuild().catch(async (error) => {
  console.error(`Embedding rebuild failed: ${error.message}`);
  await pool.end().catch(() => {});
  process.exit(1);
});
