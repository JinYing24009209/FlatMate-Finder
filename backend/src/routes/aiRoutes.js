const router = require('express').Router();
const { pool } = require('../config/database');
const { auth, allow } = require('../middleware/auth');
const { asyncRoute } = require('../middleware/errorHandler');
const ai = require('../services/aiService');
const select = `
  SELECT l.*, u.full_name advertiser_name,
    COALESCE(
      json_agg(DISTINCT p.photo_url) FILTER (WHERE p.photo_url IS NOT NULL),
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
    const { rows: savedListings } = await pool.query(
      `
        SELECT l.rent, l.city, l.suburb, l.room_type
        FROM saved_listing s
        JOIN listing l ON l.listing_id = s.listing_id
        WHERE s.student_id = $1
        ORDER BY s.saved_at DESC
        LIMIT 12
      `,
      [req.user.userId]
    );
    const { rows } = await pool.query(
      `${select} WHERE l.status='available' GROUP BY l.listing_id,u.full_name`
    );
    const recommendations = rows
      .map((listing) => ({
        ...listing,
        ai_match: ai.listingMatchScore(listing, profile, { savedListings }),
      }))
      .sort((a, b) => b.ai_match.score - a.ai_match.score);
    res.json({
      recommendations,
      ai_notice:
        'Explainable ranking uses your budget, location, lifestyle and recent saved listings.',
    });
  })
);

router.get(
  '/ai/smart-search',
  asyncRoute(async (req, res) => {
    const interpretation = ai.parseNaturalLanguageSearch(req.query.q);
    const requestedMinRent = Number(req.query.minRent) || null;
    const requestedMaxRent = Number(req.query.maxRent) || null;
    const minRent = requestedMinRent || interpretation.minRent;
    const maxRent =
      requestedMaxRent && interpretation.maxRent
        ? Math.min(requestedMaxRent, interpretation.maxRent)
        : requestedMaxRent || interpretation.maxRent;
    const location = String(req.query.city || interpretation.city || '').trim();
    const roomType = String(req.query.roomType || interpretation.roomType || '').trim();
    const availableFrom = String(req.query.availableFrom || '').trim();
    const sql = `${select}
      WHERE l.status = 'available'
        AND ($1::numeric IS NULL OR l.rent >= $1)
        AND ($2::numeric IS NULL OR l.rent <= $2)
        AND ($3 = '' OR l.city ILIKE $3 OR l.suburb ILIKE $3)
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
      GROUP BY l.listing_id, u.full_name
      ORDER BY l.rent`;
    const params = [
      minRent,
      maxRent,
      location ? `%${location}%` : '',
      interpretation.quiet,
      interpretation.furnished,
      roomType,
      interpretation.transport ? `%${interpretation.transport}%` : '',
      interpretation.lifestyle,
      availableFrom || null,
    ];
    const { rows } = await pool.query(sql, params);
    const queryEmbedding = await ai.createEmbedding(req.query.q || '', 'RETRIEVAL_QUERY');
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
          semantic_score:
            queryEmbedding && storedVector
              ? Math.max(
                  0,
                  Math.round(ai.cosineSimilarity(queryEmbedding, storedVector) * 100)
                )
              : ai.keywordSimilarity(req.query.q, listing),
          semantic_source: queryEmbedding && storedVector ? provider.mode : 'local',
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
      notice: semanticMatches
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
    const result = await ai.generateListingSummary(req.body);
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
  asyncRoute(async (req, res) => res.json(await ai.enhancedSafetyCheck(req.body)))
);
