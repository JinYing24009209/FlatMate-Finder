const smart=require('./aiSmartSearch');
const summary=require('./aiListingSummary');
const safety=require('./aiSafetySupport');
const listing=require('./aiListingRecommendation');
const flatmate=require('./aiFlatmateRecommendation');
const {getAiProviderStatus}=require('./geminiClient');

module.exports={
  ...smart,...summary,...safety,...listing,...flatmate,getAiProviderStatus,
};
