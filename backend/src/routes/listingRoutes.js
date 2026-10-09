const router = require('express').Router();
const { pool } = require('../config/database');
const { auth, allow, fail } = require('../middleware/auth');
const { asyncRoute } = require('../middleware/errorHandler');
const { notify } = require('../services/notificationService');
const v = require('../services/validation');
const { transaction } = require('../services/transaction');
const { aiRateLimit } = require('../middleware/aiRateLimit');
const { storeListingEmbedding, enhancedSafetyCheck } = require('../services/aiService');
const select = `
  SELECT l.*, u.full_name advertiser_name, pr.advertiser_bio,
    CASE WHEN pr.display_phone THEN u.phone ELSE NULL END advertiser_phone,
    COALESCE(
      json_agg(p.photo_url ORDER BY p.display_order, p.photo_id) FILTER (WHERE p.photo_url IS NOT NULL),
      '[]'
    ) photos
  FROM listing l
  JOIN users u ON u.user_id = l.advertiser_id
  LEFT JOIN profiles pr ON pr.user_id = u.user_id
  LEFT JOIN listing_photo p ON p.listing_id = l.listing_id
`;
const grouped = ' GROUP BY l.listing_id,u.full_name,u.phone,pr.advertiser_bio,pr.display_phone';
const savePhotos = async (database, listingId, photos = []) => {
  await database.query('DELETE FROM listing_photo WHERE listing_id=$1', [listingId]);
  for (const [index, photoUrl] of photos.filter(Boolean).slice(0, 5).entries())
    await database.query(
      'INSERT INTO listing_photo (listing_id,photo_url,display_order) VALUES ($1,$2,$3)',
      [listingId, photoUrl, index]
    );
};
const listingValues = (d, owner) => [
  owner,
  d.title,
  d.description || null,
  d.rent,
  d.bond || 0,
  d.address,
  d.suburb || null,
  d.city,
  d.room_type,
  1,
  d.bathrooms || 1,
  d.house_rules || null,
  JSON.stringify(d.utilities || {}),
  JSON.stringify(d.transport_options || []),
  d.available_from,
  d.status || 'available',
];
const { searchFilters } = require('../services/listingFilters');

router.get(
  '/',
  asyncRoute(async (req, res) => {
    const { q, city, roomType, availableFrom } = searchFilters(req.query);
    let rentFilters;
    try {
      rentFilters = searchFilters(req.query);
    } catch (error) {
      return fail(res, 400, error.message);
    }
    const sql = `${select}
      WHERE l.status = 'available'
        AND (l.title ILIKE $1 OR l.description ILIKE $1 OR l.suburb ILIKE $1)
        AND ($2 = '' OR l.city ILIKE $2 OR l.suburb ILIKE $2)
        AND l.rent >= $3 AND ($4::numeric IS NULL OR l.rent <= $4)
        AND ($5 = '' OR l.room_type = $5)
        AND ($6::date IS NULL OR l.available_from <= $6::date)
      ${grouped}
      ORDER BY l.created_at DESC`;
    const { rows } = await pool.query(sql, [
      `%${q}%`,
      city,
      rentFilters.minRent,
      rentFilters.maxRent,
      roomType,
      availableFrom || null,
    ]);
    res.json({ listings: rows });
  })
);
router.get(
  '/mine',
  auth,
  allow('advertiser', 'admin'),
  asyncRoute(async (req, res) => {
    const { rows } = await pool.query(
      `${select} WHERE l.advertiser_id=$1${grouped} ORDER BY l.updated_at DESC`,
      [req.user.userId]
    );
    res.json({ listings: rows });
  })
);
router.get(
  '/:id',
  asyncRoute(async (req, res) => {
    const {
      rows: [listing],
    } = await pool.query(`${select} WHERE l.listing_id=$1${grouped}`, [req.params.id]);
    if (!listing) return fail(res, 404, 'Listing not found.');
    res.json({ listing });
  })
);
router.post(
  '/',
  auth,
  allow('advertiser', 'admin'),
  aiRateLimit,
  asyncRoute(async (req, res) => {
    const d = v.listing(req.body);
    const sql = `
      INSERT INTO listing (
        advertiser_id, title, description, rent, bond, address, suburb, city,
        room_type, bedrooms, bathrooms, house_rules, utilities,
        transport_options, available_from, status
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13::jsonb, $14::jsonb, $15, $16
      )
      RETURNING *
    `;
    const screening = await enhancedSafetyCheck(d);
    const client = await pool.connect();
    let listing;
    try {
      await client.query('BEGIN');
      ({
        rows: [listing],
      } = await client.query(sql, listingValues(d, req.user.userId)));
      await savePhotos(client, listing.listing_id, d.photos);
      if (!screening.safe)
        await client.query(
          `
            INSERT INTO report (reporter_id, listing_id, reason, description, status)
            VALUES ($1, $2, 'AI safety screening', $3, 'pending')
          `,
          [req.user.userId, listing.listing_id, screening.flags.join(' ')]
        );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    storeListingEmbedding(pool, listing).catch(console.error);
    res.status(201).json({
      message: screening.safe
        ? 'Listing created.'
        : 'Listing created and sent for a human safety review.',
      listing: { ...listing, photos: (d.photos || []).slice(0, 5) },
      screening,
    });
  })
);
router.put(
  '/:id',
  auth,
  allow('advertiser', 'admin'),
  aiRateLimit,
  asyncRoute(async (req, res) => {
    const {
      rows: [old],
    } = await pool.query('SELECT * FROM listing WHERE listing_id=$1', [req.params.id]);
    if (!old) return fail(res, 404, 'Listing not found.');
    if (req.user.role !== 'admin' && old.advertiser_id !== req.user.userId)
      return fail(res, 403, 'You can only edit your own listings.');
    const d = v.listing(req.body);
    const screening = await enhancedSafetyCheck(d);
    const sql = `
      UPDATE listing SET
        title = $1,
        description = $2,
        rent = $3,
        bond = $4,
        address = $5,
        suburb = $6,
        city = $7,
        room_type = $8,
        bedrooms = $9,
        bathrooms = $10,
        house_rules = $11,
        utilities = $12::jsonb,
        transport_options = $13::jsonb,
        available_from = $14,
        status = $15, updated_at = now()
      WHERE listing_id = $16
      RETURNING *
    `;
    const values = listingValues(d, old.advertiser_id).slice(1);
    values.push(old.listing_id);
    const client = await pool.connect();
    let listing;
    try {
      await client.query('BEGIN');
      ({
        rows: [listing],
      } = await client.query(sql, values));
      if (!listing) throw v.invalid('Listing not found.', 404);
      if (Array.isArray(d.photos)) await savePhotos(client, old.listing_id, d.photos);
      // 房源更新已锁定该行，避免并发编辑产生重复待处理举报。 | The listing row lock serializes automatic report updates.
      const risk = screening.safe
        ? 'Latest screening found no flags. Human review of the earlier report is still pending.'
        : screening.flags.join(' ');
      const pending = await client.query(`UPDATE report SET description=$2
        WHERE listing_id=$1 AND reason='AI safety screening' AND status='pending' RETURNING report_id`,
        [old.listing_id, risk]);
      if (!screening.safe && !pending.rowCount) await client.query(`INSERT INTO report
        (reporter_id,listing_id,reason,description,status) VALUES($1,$2,'AI safety screening',$3,'pending')`,
        [req.user.userId, old.listing_id, risk]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    storeListingEmbedding(pool, listing).catch(console.error);
    res.json({
      message: 'Listing updated.',
      screening,
      listing: { ...listing, photos: Array.isArray(d.photos) ? d.photos.slice(0, 5) : undefined },
    });
  })
);
router.delete(
  '/:id',
  auth,
  allow('advertiser', 'admin'),
  asyncRoute(async (req, res) => {
    const {
      rows: [listing],
    } = await pool.query('SELECT advertiser_id FROM listing WHERE listing_id=$1', [req.params.id]);
    if (!listing) return fail(res, 404, 'Listing not found.');
    if (req.user.role !== 'admin' && listing.advertiser_id !== req.user.userId)
      return fail(res, 403, 'You can only delete your own listings.');
    await pool.query('DELETE FROM listing WHERE listing_id=$1', [req.params.id]);
    res.json({ message: 'Listing deleted.' });
  })
);
router.post(
  '/:id/save',
  auth,
  allow('student'),
  asyncRoute(async (req, res) => {
    await pool.query(
      'INSERT INTO saved_listing(student_id,listing_id) VALUES ($1,$2) ON CONFLICT(student_id,listing_id) DO NOTHING',
      [req.user.userId, req.params.id]
    );
    res.status(201).json({ message: 'Listing saved.' });
  })
);
router.delete(
  '/:id/save',
  auth,
  allow('student'),
  asyncRoute(async (req, res) => {
    await pool.query('DELETE FROM saved_listing WHERE student_id=$1 AND listing_id=$2', [
      req.user.userId,
      req.params.id,
    ]);
    res.json({ message: 'Listing removed.' });
  })
);
router.post(
  '/:id/enquiries',
  auth,
  allow('student'),
  asyncRoute(async (req, res) => {
    const message = v.text(req.body.message, 'Message', 3000, true);
    const enquiry = await transaction(async (client) => {
    const {
      rows: [listing],
    } = await client.query('SELECT advertiser_id,title,status FROM listing WHERE listing_id=$1 FOR UPDATE', [
      req.params.id,
    ]);
    if (!listing) throw v.invalid('Listing not found.', 404);
    if (listing.status !== 'available') throw v.invalid(`This listing is ${listing.status}; new enquiries are not allowed.`, 409);
    const {
      rows: [enquiry],
    } = await client.query(
      'INSERT INTO enquiry(listing_id,student_id,message) VALUES($1,$2,$3) RETURNING *',
      [req.params.id, req.user.userId, message]
    );
    await client.query('INSERT INTO enquiry_message(enquiry_id,sender_id,body) VALUES ($1,$2,$3)', [
      enquiry.enquiry_id,
      req.user.userId,
      message,
    ]);
    await notify(
      listing.advertiser_id,
      'enquiry',
      `New enquiry about “${listing.title}”.`,
      'enquiry',
      enquiry.enquiry_id,
      client
    );
      return enquiry;
    });
    res.status(201).json({ message: 'Enquiry sent.', enquiry });
  })
);
router.post(
  '/:id/report',
  auth,
  asyncRoute(async (req, res) => {
    const reason = v.text(req.body.reason, 'Reason', 160, true);
    const description = v.text(req.body.description, 'Description', 3000, true);
    if (!reason || !description) return fail(res, 400, 'A reason and description are required.');
    const {
      rows: [listing],
    } = await pool.query('SELECT advertiser_id,title FROM listing WHERE listing_id=$1', [
      req.params.id,
    ]);
    if (!listing) return fail(res, 404, 'Listing not found.');
    await pool.query(
      'INSERT INTO report(reporter_id,listing_id,reported_user_id,reason,description) VALUES($1,$2,$3,$4,$5)',
      [req.user.userId, req.params.id, listing.advertiser_id, reason, description]
    );
    res.status(201).json({ message: 'Report submitted for administrator review.' });
  })
);
module.exports = router;
