const router = require('express').Router();
const { pool } = require('../config/database');
const { auth, allow } = require('../middleware/auth');
const { asyncRoute } = require('../middleware/errorHandler');
const ai = require('../services/aiService');
const { searchFilters,extraListingConditions } = require('../services/listingFilters');
const v = require('../services/validation');
const { aiRateLimit } = require('../middleware/aiRateLimit');
router.use('/ai', (req, res, next) => req.path === '/status' ? next() : aiRateLimit(req, res, next));
// Validate public text only: photos and account details never reach the provider.
function listingInput(input) {
  v.object(input);
  const result = {};
  for (const [key, max] of [['title',180],['description',10000],['city',120],['suburb',120],['house_rules',3000],['room_type',80]])
    result[key] = v.text(input[key], key, max);
  result.rent = v.number(input.rent, 'Rent');
  result.bond = v.number(input.bond, 'Bond');
  const available = input.available_from;
  if (available != null && typeof available !== 'string') throw v.invalid('Available date must be text.');
  result.available_from = v.date(available?.replace(/T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, ''), 'Available date');
  result.transport_options = v.strings(input.transport_options, 'Transport options', 20, 160);
  result.utilities = v.object(input.utilities ?? {}, 'Utilities');
  if (JSON.stringify(result.utilities).length > 3000) throw v.invalid('Utilities are too long.');
  return result;
}
const select = `
  SELECT l.*, u.full_name advertiser_name,
    COALESCE(
      json_agg(p.photo_url ORDER BY p.display_order, p.photo_id) FILTER (WHERE p.photo_url IS NOT NULL),
      '[]'
    ) photos
  FROM listing l
  JOIN users u ON u.user_id = l.advertiser_id
  LEFT JOIN listing_photo p ON p.listing_id = l.listing_id
`;

router.get(
  '/ai/recommendations',
  auth,
  allow('student'),
  asyncRoute(async (req, res) => {
    const {
      rows: [profile],
    } = await pool.query('SELECT * FROM profiles WHERE user_id=$1', [req.user.userId]);
    const { rows } = await pool.query(
      `${select} WHERE l.status='available' GROUP BY l.listing_id,u.full_name`
    );
    const scores = await ai.enhancedListingScores(profile, rows);
    const recommendations = rows
      .map((listing, index) => ({ ...listing, ai_match: scores[index] }))
      .sort((a, b) => b.ai_match.score - a.ai_match.score);
    res.json({
      recommendations,
      ai_notice:
        'Ranking uses your profile and listing information, not favourites or search history.',
    });
  })
);

router.get(
  '/ai/smart-search',
  asyncRoute(async (req, res) => {
    const requested = searchFilters(req.query);
    const searchText = requested.q;
    const interpretation = await ai.enhancedNaturalLanguageSearch(searchText);
    const explicitMin = v.number(req.query.minRent, 'Minimum rent');
    // Explicit filters override inferred values, including a deliberately entered zero.
    const { minRent, maxRent, city: location, roomType, availableFrom } = searchFilters({
      minRent: explicitMin ?? interpretation.minRent,
      maxRent: requested.maxRent ?? interpretation.maxRent,
      city: requested.city || interpretation.city,
      roomType: requested.roomType || interpretation.roomType,
      availableFrom: requested.availableFrom,
    });
    const sql = `${select}
      WHERE l.status = 'available'
        AND ($1::numeric IS NULL OR l.rent >= $1)
        AND ($2::numeric IS NULL OR l.rent <= $2)
        AND ($3 = '' OR lower(l.city)=lower($3))
        AND (
          $4 = false
          OR l.house_rules ILIKE '%quiet%'
          OR l.description ILIKE '%quiet%'
        )
        AND ($5 = false OR l.description ILIKE '%furnished%')
        AND ($6 = '' OR l.room_type ILIKE $6)
        AND ($7 = '' OR l.transport_options::text ILIKE $7)
        AND (
          $8::text[] = ARRAY[]::text[]
          OR EXISTS (
            SELECT 1 FROM unnest($8::text[]) tag
            WHERE l.description ILIKE '%' || tag || '%'
               OR l.house_rules ILIKE '%' || tag || '%'
          )
        )
        AND ($9::date IS NULL OR l.available_from <= $9::date)
        ${extraListingConditions(10)}
      GROUP BY l.listing_id, u.full_name
      ORDER BY l.rent`;
    const params = [
      minRent,
      maxRent,
      location || '',
      interpretation.quiet,
      interpretation.furnished,
      roomType,
      interpretation.transport ? `%${interpretation.transport}%` : '',
      interpretation.lifestyle,
      availableFrom || null,
      requested.transport,requested.utilities,requested.lifestyle,
    ];
    const { rows } = await pool.query(sql, params);
    const queryEmbedding = searchText
      ? await ai.createEmbedding(searchText, 'RETRIEVAL_QUERY')
      : null;
    const provider = ai.getAiProviderStatus();
    const stored = queryEmbedding
      ? await pool.query('SELECT listing_id,embedding,model FROM listing_embedding')
      : { rows: [] };
    const vectors = new Map(
      stored.rows
        .filter((row) => row.model === provider.embeddingModel)
        .map((row) => [row.listing_id, row.embedding])
    );
    let semanticMatches = 0;
    const listings = rows
      .map((listing) => {
        const storedVector = vectors.get(listing.listing_id);
        if (queryEmbedding && storedVector) semanticMatches += 1;
        return {
          ...listing,
          semantic_score: !searchText
            ? null
            :
            queryEmbedding && storedVector
              ? Math.max(0, Math.round(ai.cosineSimilarity(queryEmbedding, storedVector) * 100))
              : ai.keywordSimilarity(searchText, listing),
          semantic_source: !searchText
            ? 'filters'
            : queryEmbedding && storedVector
              ? provider.mode
              : 'local',
        };
      })
      .sort((a, b) => b.semantic_score - a.semantic_score || Number(a.rent) - Number(b.rent));
    res.json({
      interpretation: {
        ...interpretation,
        minRent,
        maxRent,
        city: location,
        roomType,
        availableFrom,
      },
      listings,
      notice: !searchText
        ? 'Structured filters are active; every result matches the selected room criteria.'
        : semanticMatches
        ? `Gemini semantic ranking is active for ${semanticMatches} matching listing${
            semanticMatches === 1 ? '' : 's'
          }.`
        : 'Natural-language parsing and local relevance ranking are active.',
    });
  })
);

router.get('/ai/status', (_req, res) => {
  const status = ai.getAiProviderStatus();
  res.json({
    available: true,
    provider: status.mode,
    external_provider_configured: status.configured,
    fallback: 'local-explainable',
  });
});

router.post(
  '/ai/summary',
  asyncRoute(async (req, res) => {
    const result = await ai.generateListingSummary(listingInput(req.body));
    res.json({
      ...result,
      disclaimer: 'Generated from advertiser-provided content; verify important details.',
    });
  })
);
router.post(
  '/ai/safety-check',
  auth,
  allow('student', 'admin'),
  asyncRoute(async (req, res) => res.json(await ai.enhancedSafetyCheck(listingInput(req.body))))
);
module.exports = router;
