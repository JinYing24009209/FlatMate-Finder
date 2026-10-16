// Local parsing and keyword ranking used when Gemini is unavailable.

const cities = require('../../../shared/nzCities.json');

function parseNaturalLanguageSearch(input = '') {
  const text = String(input).toLowerCase();
  const range = text.match(
    /(?:between|from)\s*\$?\s*(\d+(?:\.\d+)?)\s*(?:and|to|-)\s*\$?\s*(\d+(?:\.\d+)?)/i
  );
  const maximum = text.match(
    /(?:under|below|less than|up to|max(?:imum)?(?: of)?)\s*\$?\s*(\d+(?:\.\d+)?)/i
  );
  const minimum = text.match(
    /(?:over|above|at least|min(?:imum)?(?: of)?)\s*\$?\s*(\d+(?:\.\d+)?)/i
  );
  const city = cities.find((value) => text.includes(value.toLowerCase())) || '';
  const roomTypes = [
    ['single room', 'Single room'],
    ['double room', 'Double room'],
    ['shared room', 'Shared room'],
    ['studio', 'Studio'],
  ];
  const roomType = roomTypes.find(([term]) => text.includes(term))?.[1] || '';
  const transport =
    ['bus', 'train', 'ferry', 'cycle', 'bike'].find((term) => text.includes(term)) || '';
  const lifestyle = [
    ['non-smoking', 'non-smoking'],
    ['non smoker', 'non-smoker'],
    ['non-smoker', 'non-smoker'],
    ['tidy', 'tidy'],
    ['social', 'social'],
    ['pet friendly', 'pet friendly'],
    ['pets allowed', 'pets allowed'],
  ]
    .filter(([term]) => text.includes(term))
    .map(([, value]) => value);
  return {
    minRent: range ? Number(range[1]) : minimum ? Number(minimum[1]) : null,
    maxRent: range ? Number(range[2]) : maximum ? Number(maximum[1]) : null,
    city,
    quiet: /\bquiet\b/.test(text),
    furnished: /\bfurnished\b/.test(text),
    transport,
    roomType,
    lifestyle: [...new Set(lifestyle)],
  };
}

function localFlatmateSearch(input = '') {
  const text = String(input).toLowerCase();
  const dates = [...text.matchAll(/\b(\d{4}-\d{2}-\d{2})\b/g)].map((match) => match[1]);
  const city = cities.find((value) => text.includes(value.toLowerCase())) || '';
  const maximum = text.match(
    /(?:under|below|less than|up to|max(?:imum)?(?: of)?)\s*\$?\s*(\d+(?:\.\d+)?)/i
  );
  const studyHabits =
    ['morning', 'afternoon', 'evening', 'night'].find((term) => text.includes(term)) || '';
  const tags = [
    ['quiet', 'quiet'],
    ['tidy', 'tidy'],
    ['non-smoking', 'non-smoking'],
    ['non smoker', 'non-smoker'],
    ['non-smoker', 'non-smoker'],
    ['social', 'social'],
    ['early bird', 'early_bird'],
    ['night owl', 'night_owl'],
    ['music friendly', 'music_friendly'],
  ]
    .filter(([term]) => text.includes(term))
    .map(([, value]) => value);
  const from = text.match(/\bfrom\s+(\d{4}-\d{2}-\d{2})\b/i)?.[1] || null;
  const to = text.match(/\b(?:by|to|before)\s+(\d{4}-\d{2}-\d{2})\b/i)?.[1] || null;
  return {
    location: city,
    maxBudget: maximum ? Number(maximum[1]) : null,
    studyHabits,
    lifestyle: [...new Set(tags)],
    moveInFrom: from || (!to && dates.length > 1 ? dates[0] : null),
    moveInTo: to || (!from && dates.length === 1 ? dates[0] : dates[1] || null),
  };
}

function keywordSimilarity(query, listing) {
  const ignored = new Set([
    'a',
    'an',
    'and',
    'for',
    'i',
    'in',
    'is',
    'me',
    'my',
    'of',
    'room',
    'that',
    'the',
    'to',
    'with',
  ]);
  const terms = [
    ...new Set(
      String(query)
        .toLowerCase()
        .match(/[\p{L}\p{N}]+/gu) || []
    ),
  ].filter((term) => term.length > 1 && !ignored.has(term));
  if (!terms.length) return 0;
  const haystack = [
    listing.title,
    listing.description,
    listing.city,
    listing.suburb,
    listing.room_type,
    listing.house_rules,
    ...(listing.transport_options || []),
    ...Object.keys(listing.utilities || {}),
    ...(listing.lifestyle_tags || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const matched = terms.filter((term) => haystack.includes(term));
  return Math.round((matched.length / terms.length) * 100);
}

function localListingMatch(query, listing) {
  const score = keywordSimilarity(query, listing);
  return {
    score,
    matched: [],
    conflicts: [],
    missing_information: [],
    reason: score
      ? `Local keywords matched ${score}% of the searchable terms.`
      : 'No local keyword match was found.',
    hard_requirement_conflict: false,
    mode: 'local-fallback',
  };
}

function localFlatmateSmartMatch(query, profile) {
  const normalisedQuery = String(query).replace(/\bquite\b/gi, 'quiet');
  const searchableProfile = {
    title: profile.full_name,
    description: profile.about_me,
    city: profile.preferred_city,
    suburb: profile.preferred_suburb,
    room_type: profile.study_habits,
    house_rules: profile.preferred_location,
    transport_options: profile.lifestyle_tags || [],
    utilities: {},
    lifestyle_tags: [
      profile.move_in_date,
      profile.move_in_flexible ? 'flexible move in' : '',
      profile.budget_min == null ? '' : `minimum budget ${profile.budget_min}`,
      profile.budget_max == null ? '' : `maximum budget ${profile.budget_max}`,
    ],
  };
  const score = keywordSimilarity(normalisedQuery, searchableProfile);
  return {
    score,
    matched: [],
    missing_information: [],
    reason: score
      ? `Local search matched ${score}% of the profile terms.`
      : 'No local profile terms matched the request.',
    mode: 'local-fallback',
  };
}

module.exports = {
  parseNaturalLanguageSearch,
  localFlatmateSearch,
  keywordSimilarity,
  localListingMatch,
  localFlatmateSmartMatch,
};
