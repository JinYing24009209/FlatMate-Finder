const test = require('node:test');
const assert = require('node:assert/strict');
// Reload the feature module that owns the cache; production callers still use aiService.
const mod = require.resolve('../src/services/aiFlatmateRecommendation');
const prefs = {
  preferred_location: 'Albany',
  budget_min: 150,
  budget_max: 280,
  study_habits: 'Morning',
  lifestyle_tags: ['tidy'],
};
function setup(t, fetcher, mode = 'gemini') {
  const old = { mode: process.env.AI_MODE, key: process.env.GEMINI_API_KEY, fetch: global.fetch };
  process.env.AI_MODE = mode;
  process.env.GEMINI_API_KEY = 'test-only';
  global.fetch = fetcher;
  delete require.cache[mod];
  t.after(() => {
    global.fetch = old.fetch;
    for (const [k, v] of [
      ['AI_MODE', old.mode],
      ['GEMINI_API_KEY', old.key],
    ]) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    delete require.cache[mod];
  });
  return require(mod);
}
const response = (value) => ({
  ok: true,
  json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] } }] }),
});
test('Gemini batch preserves IDs, excludes identity, and cache is shared with details', async (t) => {
  let calls = 0;
  const ai = setup(t, async (url, options) => {
    calls++;
    const body = JSON.parse(options.body);
    const prompt = body.contents[0].parts[0].text;
    assert(!prompt.includes('SECRET'));
    assert(options.signal);
    return response({
      matches: [
        { index: 1, score: 65, breakdown: ['Different routines'] },
        { index: 0, score: 92, breakdown: ['Shared preferences'] },
      ],
    });
  });
  const candidates = [
    { ...prefs, full_name: 'SECRET', email: 'SECRET', profile_photo: 'SECRET' },
    { ...prefs, study_habits: 'Night' },
  ];
  const result = await ai.enhancedFlatmateScores(prefs, candidates);
  assert.deepEqual(
    result.map((x) => x.score),
    [92, 65]
  );
  assert(result.every((x) => x.mode === 'gemini'));
  assert.equal((await ai.enhancedFlatmateMatchScore(prefs, candidates[0])).score, 92);
  assert.equal(calls, 1);
  await ai.enhancedFlatmateMatchScore({ ...prefs, budget_max: 320 }, candidates[0]);
  assert.equal(calls, 2);
});
test('local mode never calls Gemini and preserves original scoring', async (t) => {
  const ai = setup(
    t,
    () => {
      throw Error('Must not call');
    },
    'local'
  );
  const result = await ai.enhancedFlatmateMatchScore(prefs, prefs);
  assert.equal(result.score, ai.flatmateMatchScore(prefs, prefs).score);
  assert.equal(result.mode, 'local-fallback');
});
test('missing comparable preferences never invent a score', async (t) => {
  const ai = setup(t, () => {
    throw Error('Must not call');
  });
  assert.equal((await ai.enhancedFlatmateMatchScore({}, prefs)).score, null);
  assert.equal(
    (
      await ai.enhancedFlatmateMatchScore(
        { study_habits: 'Morning' },
        { preferred_location: 'Albany' }
      )
    ).score,
    null
  );
});
test('malformed and duplicate Gemini entries fall back individually', async (t) => {
  const ai = setup(t, async () =>
    response({
      matches: [
        { index: 0, score: 99, breakdown: ['Valid'] },
        { index: 1, score: 1000, breakdown: ['Invalid'] },
        { index: 2, score: 80, breakdown: ['Duplicate'] },
        { index: 2, score: 81, breakdown: ['Duplicate'] },
      ],
    })
  );
  const results = await ai.enhancedFlatmateScores(prefs, [
    prefs,
    { ...prefs, study_habits: 'Night' },
    { ...prefs, preferred_location: 'Wellington' },
  ]);
  assert.equal(results[0].mode, 'gemini');
  assert.equal(results[1].mode, 'local-fallback');
  assert.equal(results[2].mode, 'local-fallback');
});
test('network failure falls back and is not cached as an AI success', async (t) => {
  let calls = 0;
  const ai = setup(t, async () => {
    calls++;
    throw Error('Network failed');
  });
  const result = await ai.enhancedFlatmateMatchScore(prefs, prefs);
  assert.equal(result.mode, 'local-fallback');
  assert.equal(result.score, ai.flatmateMatchScore(prefs, prefs).score);
  await ai.enhancedFlatmateMatchScore(prefs, prefs);
  assert.equal(calls, 2);
});
test('non-JSON model text falls back', async (t) => {
  const ai = setup(t, async () => ({
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text: 'not json' }] } }] }),
  }));
  assert.equal((await ai.enhancedFlatmateMatchScore(prefs, prefs)).mode, 'local-fallback');
});
test('provider HTTP failure retries then falls back', async (t) => {
  let calls = 0;
  const ai = setup(t, async () => {
    calls++;
    return { ok: false, status: 503 };
  });
  assert.equal((await ai.enhancedFlatmateMatchScore(prefs, prefs)).mode, 'local-fallback');
  assert.equal(calls, 2);
});

test('request deadline aborts a slow provider and returns local scores', async (t) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10);
  t.after(() => clearTimeout(timer));
  t.mock.method(AbortSignal, 'timeout', () => controller.signal);
  const ai = setup(
    t,
    async (_url, options) =>
      new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(new Error('aborted')), {
          once: true,
        });
      })
  );
  const result = await ai.enhancedFlatmateMatchScore(prefs, prefs);
  assert.equal(result.mode, 'local-fallback');
  assert.equal(result.score, ai.flatmateMatchScore(prefs, prefs).score);
});
