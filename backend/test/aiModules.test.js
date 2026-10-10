const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const api=require('../src/services/aiService');

test('compatibility entry exports the same feature function instances',()=>{
  const features={
    aiSmartSearch:['enhancedNaturalLanguageSearch','enhancedFlatmateSearch','parseNaturalLanguageSearch','createEmbedding','cosineSimilarity','storeListingEmbedding','keywordSimilarity'],
    aiListingSummary:['generateListingSummary','summariseListing','formatDateOnly'],
    aiSafetySupport:['enhancedSafetyCheck','safetyCheck'],
    aiListingRecommendation:['enhancedListingScores','listingMatchScore'],
    aiFlatmateRecommendation:['enhancedFlatmateScores','enhancedFlatmateMatchScore','flatmateMatchScore'],
  };
  for(const [file,names] of Object.entries(features)){
    const feature=require('../src/services/'+file);
    assert.deepEqual(Object.keys(feature).sort(),[...names].sort());
    for(const name of names)assert.equal(api[name],feature[name],name);
  }
  assert.deepEqual(Object.keys(api).sort(),[...Object.values(features).flat(),'getAiProviderStatus'].sort());
  assert.equal(api.getAiProviderStatus,require('../src/services/geminiClient').getAiProviderStatus);
});

test('five owned feature files clearly place external AI before local algorithms',()=>{
  for(const file of ['aiSmartSearch','aiListingSummary','aiSafetySupport','aiListingRecommendation','aiFlatmateRecommendation']){
    const source=fs.readFileSync(path.join(__dirname,'../src/services',file+'.js'),'utf8');
    assert.ok(source.startsWith('// AI-enhanced'));
    assert.ok(source.includes('This AI function primarily uses external AI for implementation. In case of problems with the AI invocation, a local fallback algorithm is provided as a backup.'));
    const external=source.indexOf('External AI invocation (Gemini takes priority)'),local=source.indexOf('Local algorithm (fallback on failure)');
    assert.ok(external>=0&&local>external);
    const names={aiSmartSearch:['parseNaturalLanguageSearch','localFlatmateSearch','keywordSimilarity'],aiListingSummary:['summariseListing'],aiSafetySupport:['safetyCheck'],aiListingRecommendation:['listingMatchScore','localListingScores'],aiFlatmateRecommendation:['flatmateMatchScore','localFlatmateScores']}[file];
    for(const name of names)assert.ok(source.indexOf('function '+name+'(')>local,name+' must be in the local section');
  }
});
