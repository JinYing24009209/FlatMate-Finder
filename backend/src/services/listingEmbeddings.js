// Gemini embedding helpers for persisted listing vectors.
const { fetchWithRetry } = require('./geminiClient');

async function createEmbedding(text, taskType = 'SEMANTIC_SIMILARITY') {
  try {
    if (process.env.GEMINI_API_KEY) {
      const model = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001';
      const response = await fetchWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent`,
        {
          method: 'POST',
          headers: {
            'x-goog-api-key': process.env.GEMINI_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            taskType,
            content: { parts: [{ text: text.slice(0, 8000) }] },
          }),
        }
      );
      if (!response.ok) throw new Error(`Gemini embedding service returned ${response.status}.`);
      const data = await response.json();
      return data.embedding?.values || data.embeddings?.[0]?.values || null;
    }
    return null;
  } catch (error) {
    console.warn(`Embedding fallback: ${error.message}`);
    return null;
  }
}

function cosineSimilarity(a, b) {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0,
    aa = 0,
    bb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    aa += a[i] ** 2;
    bb += b[i] ** 2;
  }
  return dot / (Math.sqrt(aa) * Math.sqrt(bb) || 1);
}

async function storeListingEmbedding(pool, listing) {
  const vector = await createEmbedding(
    [
      listing.title,
      listing.description || '',
      listing.city,
      listing.room_type,
      listing.house_rules || '',
    ].join('. '),
    'RETRIEVAL_DOCUMENT'
  );
  if (vector)
    await pool.query(
      `
        INSERT INTO listing_embedding (listing_id, embedding, model)
        VALUES ($1, $2::jsonb, $3)
        ON CONFLICT(listing_id) DO UPDATE SET
          embedding = EXCLUDED.embedding,
          model = EXCLUDED.model,
          updated_at = now()
      `,
      [
        listing.listing_id,
        JSON.stringify(vector),
        process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001',
      ]
    );
  return vector;
}

module.exports = { createEmbedding, cosineSimilarity, storeListingEmbedding };
