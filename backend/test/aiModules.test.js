const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const api = require('../src/services/aiService');

test('compatibility entry exports the same feature function instances', () => {
  const features = {
    aiSmartSearch: [
      'enhancedNaturalLanguageSearch',
      'enhancedFlatmateSearch',
      'rankFlatmatesForSmartSearch',
      'rankListingsForSmartSearch',
      'parseNaturalLanguageSearch',
      'localFlatmateSearch',
      'keywordSimilarity',
      'createEmbedding',
      'cosineSimilarity',
      'storeListingEmbedding',
    ],
    aiListingSummary: ['generateListingSummary', 'summariseListing', 'formatDateOnly'],
    aiSafetySupport: ['enhancedSafetyCheck', 'safetyCheck'],
    aiListingRecommendation: ['enhancedListingScores', 'listingMatchScore'],
    aiFlatmateRecommendation: [
      'enhancedFlatmateScores',
      'enhancedFlatmateMatchScore',
      'flatmateMatchScore',
    ],
  };
  for (const [file, names] of Object.entries(features)) {
    const feature = require('../src/services/' + file);
    assert.deepEqual(Object.keys(feature).sort(), [...names].sort());
    for (const name of names) assert.equal(api[name], feature[name], name);
  }
  assert.deepEqual(
    Object.keys(api).sort(),
    [...Object.values(features).flat(), 'getAiProviderStatus'].sort()
  );
  assert.equal(
    api.getAiProviderStatus,
    require('../src/services/geminiClient').getAiProviderStatus
  );
});

test('all five AI features clearly place external AI before their local fallback algorithms', () => {
  const smart = fs.readFileSync(path.join(__dirname, '../src/services/aiSmartSearch.js'), 'utf8');
  const localSmart = fs.readFileSync(
    path.join(__dirname, '../src/services/localSmartSearch.js'),
    'utf8'
  );
  assert.ok(smart.startsWith('// Smart-search orchestration'));
  assert.ok(smart.includes('rankListingsForSmartSearch'));
  for (const name of ['parseNaturalLanguageSearch', 'localFlatmateSearch', 'keywordSimilarity'])
    assert.ok(localSmart.includes('function ' + name + '('));

  for (const file of [
    'aiListingSummary',
    'aiSafetySupport',
    'aiListingRecommendation',
    'aiFlatmateRecommendation',
  ]) {
    const source = fs.readFileSync(path.join(__dirname, '../src/services', file + '.js'), 'utf8');
    assert.ok(source.startsWith('// '));
    assert.ok(source.includes('Gemini and a local fallback'));
    const external = source.indexOf('Gemini implementation'),
      local = source.indexOf('Local fallback used when Gemini is unavailable');
    assert.ok(external >= 0 && local > external);
    const names = {
      aiListingSummary: ['summariseListing'],
      aiSafetySupport: ['safetyCheck'],
      aiListingRecommendation: ['listingMatchScore', 'localListingScores'],
      aiFlatmateRecommendation: ['flatmateMatchScore', 'localFlatmateScores'],
    }[file];
    for (const name of names)
      assert.ok(
        source.indexOf('function ' + name + '(') > local,
        name + ' must be in the local section'
      );
  }
});
