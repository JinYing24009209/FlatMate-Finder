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
test('listing recommendation rewards budget and location fit', () => {
  const result = ai.listingMatchScore(
    { rent: 220, city: 'Auckland', suburb: 'Albany', description: 'quiet home' },
    { budget_max: 250, preferred_location: 'Albany', lifestyle_tags: ['quiet'] }
  );
  assert.equal(result.score, 90);
  assert.equal(result.reasons.length, 3);
});
test('flatmate matching varies by shared profile fields', () => {
  const mine = {
    budget_min: 150,
    budget_max: 250,
    preferred_location: 'Albany',
    study_habits: 'Morning',
    lifestyle_tags: ['quiet', 'tidy'],
  };
  const close = ai.flatmateMatchScore(mine, {
    budget_min: 180,
    budget_max: 260,
    preferred_location: 'Albany',
    study_habits: 'Morning',
    lifestyle_tags: ['quiet'],
  });
  const different = ai.flatmateMatchScore(mine, {
    budget_min: 500,
    budget_max: 600,
    preferred_location: 'CBD',
    study_habits: 'Night',
    lifestyle_tags: ['social'],
  });
  assert.ok(close.score > different.score);
  assert.ok(close.breakdown.length > 1);
});
test('flatmate matching does not invent a percentage for an empty profile', () => {
  assert.equal(ai.flatmateMatchScore({}, { preferred_location: 'Albany' }).score, null);
});
test('summary highlights core facts', () => {
  assert.match(
    ai.summariseListing({
      description: 'Sunny room. More copy.',
      rent: 230,
      city: 'Auckland',
      available_from: '2026-09-01',
    }),
    /Rent: \$230\/week/
  );
});
test('safety screening explains suspicious payment language', () => {
  const result = ai.safetyCheck({
    description: 'Pay before viewing by crypto and send deposit urgently.',
    address: '',
  });
  assert.equal(result.safe, false);
  assert.ok(result.risk_score > 0);
  assert.ok(result.flags.length >= 2);
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
test('Gemini listing summary uses structured output without exposing contact data', async () => {
  const originalFetch = global.fetch;
  const originalMode = process.env.AI_MODE;
  const originalKey = process.env.GEMINI_API_KEY;
  process.env.AI_MODE = 'gemini';
  process.env.GEMINI_API_KEY = 'test-key';
  let requestBody;
  global.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '{"summary":"A concise room summary."}' }] } }],
      }),
    };
  };
  try {
    const result = await ai.generateListingSummary({
      title: 'Sunny room',
      description: 'Bright room near campus.',
      rent: 230,
      city: 'Auckland',
      email: 'private@example.test',
    });
    assert.equal(result.mode, 'gemini');
    assert.equal(result.summary, 'A concise room summary.');
    assert.doesNotMatch(JSON.stringify(requestBody), /private@example\.test/);
  } finally {
    global.fetch = originalFetch;
    process.env.AI_MODE = originalMode;
    process.env.GEMINI_API_KEY = originalKey;
  }
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
