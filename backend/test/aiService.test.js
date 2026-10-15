const test = require('node:test');
const assert = require('node:assert/strict');
const ai = require('../src/services/aiService');

test('Gemini JSON parser accepts fenced output and trailing commas', async () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-key';
  global.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: '```json\n{"value": 7,}\n```' }] } }],
    }),
  });
  try {
    const { generateGeminiJson } = require('../src/services/geminiClient');
    assert.deepEqual(await generateGeminiJson('Return test JSON.'), { value: 7 });
  } finally {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  }
});

test('flatmate smart search validates Gemini filters and keeps ISO dates out of rent parsing', async () => {
  const originalFetch = global.fetch,
    originalKey = process.env.GEMINI_API_KEY,
    originalMode = process.env.AI_MODE;
  process.env.GEMINI_API_KEY = 'test-key';
  process.env.AI_MODE = 'gemini';
  let payload = {
    location: 'Auckland',
    maxBudget: 0,
    studyHabits: 'morning',
    lifestyle: ['quiet'],
    moveInFrom: '2026-11-01',
    moveInTo: null,
  };
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }],
    }),
  });
  try {
    const gemini = await ai.enhancedFlatmateSearch('quiet Auckland morning flatmate');
    assert.equal(gemini.mode, 'gemini');
    assert.equal(gemini.maxBudget, 0);
    assert.equal(gemini.moveInFrom, '2026-11-01');
    payload = { maxBudget: -10 };
    const fallback = await ai.enhancedFlatmateSearch(
      'quiet Auckland under $300 from 2026-11-01 to 2026-12-01'
    );
    assert.equal(fallback.mode, 'local-fallback');
    assert.equal(fallback.maxBudget, 300);
    assert.equal(fallback.moveInFrom, '2026-11-01');
    assert.equal(fallback.moveInTo, '2026-12-01');
    await assert.rejects(ai.enhancedFlatmateSearch('x'.repeat(1001)), /1000/);
  } finally {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
    if (originalMode === undefined) delete process.env.AI_MODE;
    else process.env.AI_MODE = originalMode;
  }
});

test('listing smart search uses validated Gemini filters and falls back to local parsing', async () => {
  const originalFetch = global.fetch,
    originalKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-key';
  let payload = {
    minRent: 180,
    maxRent: 280,
    city: 'Auckland',
    quiet: true,
    furnished: false,
    transport: 'bus',
    roomType: 'private room',
    lifestyle: ['tidy'],
  };
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }],
    }),
  });
  try {
    const result = await ai.enhancedNaturalLanguageSearch('tidy room near a bus');
    assert.equal(result.mode, 'gemini');
    assert.equal(result.maxRent, 280);
    assert.deepEqual(result.lifestyle, ['tidy']);
    assert.equal(result.roomType, 'Single room');
    payload = { minRent: 300, maxRent: 200, lifestyle: [] };
    const fallback = await ai.enhancedNaturalLanguageSearch('quiet Auckland room under $250');
    assert.equal(fallback.mode, 'local-fallback');
    assert.equal(fallback.maxRent, 250);
    assert.equal(fallback.city, 'Auckland');
  } finally {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  }
});

test('flatmate smart search ranks the complete profile, including about-me text', async () => {
  const originalMode = process.env.AI_MODE;
  process.env.AI_MODE = 'local';
  try {
    const results = await ai.rankFlatmatesForSmartSearch('quiet flatmate in Auckland', [
      {
        about_me: 'I am a quiet person looking to share in Auckland.',
        lifestyle_tags: [],
      },
      { about_me: 'I enjoy parties in Wellington.', lifestyle_tags: ['social'] },
    ]);
    assert.equal(results.length, 2);
    assert(results[0].score > results[1].score);
    assert.equal(results[0].mode, 'local-fallback');
  } finally {
    if (originalMode === undefined) delete process.env.AI_MODE;
    else process.env.AI_MODE = originalMode;
  }
});

test('Gemini compares listing meaning and receives no contact or street-address fields', async () => {
  const originalFetch = global.fetch,
    originalKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-key';
  let prompt = '';
  global.fetch = async (_url, options) => {
    prompt = JSON.parse(options.body).contents[0].parts[0].text;
    return {
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    matches: [
                      {
                        index: 0,
                        score: 12,
                        matched: [],
                        conflicts: ['Pets are not allowed'],
                        missing_information: [],
                        reason: 'The house rule conflicts with the request.',
                        hard_requirement_conflict: true,
                      },
                      {
                        index: 1,
                        score: 93,
                        matched: ['Pets are allowed'],
                        conflicts: [],
                        missing_information: [],
                        reason: 'The listing explicitly welcomes pets.',
                        hard_requirement_conflict: false,
                      },
                    ],
                  }),
                },
              ],
            },
          },
        ],
      }),
    };
  };
  try {
    const listings = [
      {
        title: 'Room one',
        house_rules: 'No pets',
        email: 'private@example.test',
        address: '1 Secret Street',
      },
      { title: 'Room two', description: 'Pet-friendly home', advertiser_name: 'Private Owner' },
    ];
    const result = await ai.rankListingsForSmartSearch('I need a home that allows pets', listings);
    assert.equal(result[0].score, 12);
    assert.deepEqual(result[0].conflicts, ['Pets are not allowed']);
    assert.equal(result[1].score, 93);
    assert.deepEqual(result[1].matched, ['Pets are allowed']);
    assert.doesNotMatch(prompt, /private@example\.test|Secret Street|Private Owner/);
    assert.match(prompt, /pets allowed.*no pets/i);
  } finally {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  }
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
test('summary displays an available date without an ISO timestamp', () => {
  const result = ai.summariseListing({
    description: 'Sunny room.',
    available_from: '2026-08-31T12:00:00.000Z',
  });
  assert.match(result, /Available: 2026-08-31/);
  assert.doesNotMatch(result, /T12:00:00/);
});
test('smart search with no natural-language text is identified as filters only', async () => {
  const result = await ai.enhancedNaturalLanguageSearch('');
  assert.equal(result.mode, 'filters-only');
  assert.equal(result.roomType, '');
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
test('invalid Gemini listing comparisons use local keyword ranking', async () => {
  const originalFetch = global.fetch,
    originalKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-key';
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text: '{"matches":[]}' }] } }] }),
  });
  try {
    const [result] = await ai.rankListingsForSmartSearch('quiet room', [{ title: 'Quiet room' }]);
    assert.equal(result.mode, 'local-fallback');
    assert.equal(result.score, 100);
  } finally {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  }
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

test('Gemini listing recommendation uses sanitised saved listings and recent searches', async () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-key';
  let prompt;
  global.fetch = async (_url, options) => {
    prompt = JSON.parse(options.body).contents[0].parts[0].text;
    return {
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    matches: [{ index: 0, score: 85, reasons: ['Fits the budget.'] }],
                  }),
                },
              ],
            },
          },
        ],
      }),
    };
  };
  try {
    const saved = Array.from({ length: 15 }, () => ({
      rent: 200,
      city: 'Auckland',
      suburb: 'Albany',
      room_type: 'Single room',
      email: 'hidden@example.invalid',
      address: 'Hidden street',
      listing_id: 12345,
    }));
    const result = await ai.enhancedListingScores(
      { budget_max: 250 },
      [{ rent: 220, city: 'Auckland' }],
      { savedListings: saved, recentSearches: ['quiet room near a bus'] }
    );
    assert.equal(result[0].mode, 'gemini');
    const payload = JSON.parse(prompt.slice(prompt.indexOf('{"preferences"')));
    assert.equal(payload.saved_listing_patterns.length, 10);
    assert.deepEqual(payload.recent_searches, ['quiet room near a bus']);
    assert.deepEqual(Object.keys(payload).sort(), [
      'listings',
      'preferences',
      'recent_searches',
      'saved_listing_patterns',
    ]);
    assert.doesNotMatch(prompt, /hidden@example|Hidden street|12345/);
    assert.match(prompt, /saved-listing patterns/);
  } finally {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  }
});
