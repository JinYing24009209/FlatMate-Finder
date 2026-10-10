const {generateGeminiJson}=require('./geminiClient');

//external AI
async function enhancedListingScores(profile, listings) {
  const localFallback = () => localListingScores(profile, listings);
  if (!profile || !listings.length) return localFallback();
  // 1. GEMINI
  try {
    const result = await generateGeminiJson(
      [
        'Rank student accommodation listings against the supplied housing preferences.',
        'Use only the explicit profile and candidate listing information. No favourites are supplied.',
        'No search history is supplied. Do not claim to use past searches or infer unstated facts.',
        'Return {"matches":[{"index":0,"score":80,"reasons":["short factual reason"]}]}.',
        'Include each index once; score integer 0-100; 1-4 reasons. Do not infer sensitive traits.',
        JSON.stringify({
          preferences: {
            budget_max: profile.budget_max,
            preferred_location: profile.preferred_location,
            lifestyle_tags: profile.lifestyle_tags || [],
          },
          listings: listings.map((item, index) => ({
            index,
            rent: item.rent,
            city: item.city,
            suburb: item.suburb,
            room_type: item.room_type,
            description: String(item.description || '').slice(0, 500),
            house_rules: String(item.house_rules || '').slice(0, 300),
          })),
        }),
      ].join('\n')
    );
    if (!Array.isArray(result?.matches)) return localFallback();
    const fallback = localFallback();
    result.matches.forEach((item) => {
      if (
        Number.isInteger(item?.index) &&
        fallback[item.index] &&
        Number.isInteger(item.score) &&
        item.score >= 0 &&
        item.score <= 100 &&
        Array.isArray(item.reasons) &&
        item.reasons.length
      )
        fallback[item.index] = {
          score: item.score,
          reasons: item.reasons.slice(0, 4).map(String),
          mode: 'gemini',
        };
    });
    return fallback;
  } catch (error) {
    console.warn(`Listing recommendation AI fallback: ${error.message}`);
  }
  // 2. Local fallback
  return localFallback();
}

//local algorithm
function localListingScores(profile, listings) {
  return listings.map(listing=>({...listingMatchScore(listing,profile),mode:'local-fallback'}));
}

function listingMatchScore(listing, profile, context = {}) {
  if (!profile) return { score: 50, reasons: ['Complete your profile for a personalised score.'] };
  let score = 25;
  const reasons = [];
  if (profile.budget_max && Number(listing.rent) <= Number(profile.budget_max)) {
    score += 30;
    reasons.push('within your budget');
  }
  if (
    profile.preferred_location &&
    `${listing.city} ${listing.suburb || ''}`
      .toLowerCase()
      .includes(profile.preferred_location.toLowerCase())
  ) {
    score += 25;
    reasons.push('matches your location');
  }
  const tags = (profile.lifestyle_tags || []).map((x) => x.toLowerCase());
  const text = `${listing.description || ''} ${listing.house_rules || ''}`.toLowerCase();
  const overlaps = tags.filter((tag) => text.includes(tag));
  if (overlaps.length) {
    score += Math.min(20, overlaps.length * 10);
    reasons.push(`mentions ${overlaps.join(', ')}`);
  }
  const savedListings = context.savedListings || [];
  if (savedListings.length) {
    const savedLocations = savedListings.map((saved) => saved.suburb || saved.city).filter(Boolean);
    const savedTypes = savedListings.map((saved) => saved.room_type).filter(Boolean);
    const averageRent =
      savedListings.reduce((sum, saved) => sum + Number(saved.rent || 0), 0) / savedListings.length;
    if (savedLocations.includes(listing.suburb || listing.city)) {
      score += 8;
      reasons.push('similar to a location you saved');
    }
    if (savedTypes.includes(listing.room_type)) {
      score += 5;
      reasons.push('matches a room type you saved');
    }
    if (averageRent && Math.abs(Number(listing.rent) - averageRent) <= 40) {
      score += 7;
      reasons.push('close to the rent of rooms you saved');
    }
  }
  return {
    score: Math.min(100, score),
    reasons: reasons.length ? reasons : ['general listing match'],
  };
}

module.exports={enhancedListingScores,listingMatchScore};
