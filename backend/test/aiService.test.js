const test = require('node:test');
const assert = require('node:assert/strict');
const ai = require('../src/services/aiService');

test('smart search understands rent, city, lifestyle and transport', () => {
  const result = ai.parseNaturalLanguageSearch(
    'Quiet furnished single room in Auckland under $250 near a bus'
  );
  assert.deepEqual(result, {
    minRent: null,
    maxRent: 250,
    city: 'auckland',
    quiet: true,
    furnished: true,
    transport: 'bus',
    roomType: 'single room',
    lifestyle: [],
  });
});
test('smart search understands a rent range and lifestyle terms', () => {
  const result = ai.parseNaturalLanguageSearch(
    'Tidy non-smoker looking for a room between $180 and $280'
  );
  assert.equal(result.minRent, 180);
  assert.equal(result.maxRent, 280);
  assert.deepEqual(result.lifestyle, ['non-smoker', 'tidy']);
});
test('cosine similarity supports semantic ranking', () => {
  assert.equal(ai.cosineSimilarity([1, 0], [1, 0]), 1);
  assert.equal(ai.cosineSimilarity([1, 0], [0, 1]), 0);
});
test('local relevance ranking remains available without an external provider', () => {
  const score = ai.keywordSimilarity('quiet bus Albany', {
    title: 'Quiet Albany room',
    description: 'A calm home near the university',
    suburb: 'Albany',
    city: 'Auckland',
    room_type: 'Single room',
    transport_options: ['Bus stop'],
  });
  assert.equal(score, 100);
});
test('embedding errors fall back cleanly instead of breaking smart search', async () => {
  const originalFetch = global.fetch;
  const originalMode = process.env.AI_MODE;
  const originalKey = process.env.GEMINI_API_KEY;
  process.env.AI_MODE = 'gemini';
  process.env.GEMINI_API_KEY = 'test-key';
  global.fetch = async () => ({ ok: false, status: 503 });
  try {
    assert.equal(await ai.createEmbedding('quiet room', 'RETRIEVAL_QUERY'), null);
  } finally {
    global.fetch = originalFetch;
    process.env.AI_MODE = originalMode;
    process.env.GEMINI_API_KEY = originalKey;
  }
});
