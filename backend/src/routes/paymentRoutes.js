const router = require('express').Router();
const { pool } = require('../config/database');
const { auth, allow, fail } = require('../middleware/auth');
const { asyncRoute } = require('../middleware/errorHandler');

const paymentSelect = `
  SELECT p.*, l.title listing_title, l.address, l.suburb, l.city,
    l.rent, l.status listing_status, u.full_name advertiser_name
  FROM rental_payment p
  JOIN listing l ON l.listing_id = p.listing_id
  JOIN users u ON u.user_id = l.advertiser_id
`;

router.use(auth, allow('student'));

router.post(
  '/checkout',
  asyncRoute(async (req, res) => {
    const { rows: [student] } = await pool.query(
      'SELECT student_type FROM users WHERE user_id=$1',
      [req.user.userId]
    );
    if (student?.student_type !== 'housing')
      return fail(res, 403, 'Only accommodation-seeking students can start a rental payment.');
    const { rows: [listing] } = await pool.query(
      `SELECT listing_id, advertiser_id, title, address, suburb, city, rent, status
       FROM listing WHERE listing_id=$1`,
      [req.body.listing_id]
    );
    if (!listing) return fail(res, 404, 'Listing not found.');
    if (listing.status !== 'available')
      return fail(res, 409, 'This listing is no longer available for payment.');
    const amount = Number(listing.rent);
    const { rows: [payment] } = await pool.query(
      `INSERT INTO rental_payment
        (listing_id, student_id, amount, currency, purpose, status, provider)
       VALUES ($1,$2,$3,'NZD','holding_deposit','pending','coursework-demo')
       ON CONFLICT (student_id, listing_id) WHERE status='pending'
       DO UPDATE SET amount=EXCLUDED.amount, created_at=now()
       RETURNING *`,
      [listing.listing_id, req.user.userId, amount]
    );
    res.status(201).json({
      payment: { ...listing, ...payment, listing_status: listing.status },
      demo_notice: 'Coursework demonstration only. No real money or card details are processed.',
    });
  })
);

router.post(
  '/:id/complete-demo',
  asyncRoute(async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: [payment] } = await client.query(
        `${paymentSelect} WHERE p.payment_id=$1 AND p.student_id=$2 FOR UPDATE OF p,l`,
        [req.params.id, req.user.userId]
      );
      if (!payment) {
        await client.query('ROLLBACK');
        return fail(res, 404, 'Payment not found.');
      }
      if (payment.listing_status !== 'available') {
        await client.query('ROLLBACK');
        return fail(res, 409, 'The listing became unavailable before payment was completed.');
      }
      if (payment.status !== 'pending') {
        await client.query('ROLLBACK');
        return fail(res, 409, `This demo payment is already ${payment.status}.`);
      }
      const reference = `DEMO-${payment.payment_id}-${Date.now()}`;
      const { rows: [updated] } = await client.query(
        `UPDATE rental_payment SET status='succeeded', provider_reference=$1, completed_at=now()
         WHERE payment_id=$2 RETURNING *`,
        [reference, payment.payment_id]
      );
      await client.query(
        `UPDATE listing SET status='shortlisted', updated_at=now()
         WHERE listing_id=$1 AND status='available'`,
        [payment.listing_id]
      );
      const { rows: [owner] } = await client.query(
        'SELECT advertiser_id FROM listing WHERE listing_id=$1',
        [payment.listing_id]
      );
      await client.query(
        `INSERT INTO notification
          (user_id,type,message,related_entity_type,related_entity_id)
         VALUES ($1,'demo_payment',$2,'listing',$3)`,
        [owner.advertiser_id, `A student completed a demo holding payment for ${payment.listing_title}.`, payment.listing_id]
      );
      await client.query('COMMIT');
      res.json({
        payment: { ...updated, listing_status: 'shortlisted' },
        message: 'Demo payment completed and the listing was temporarily reserved. No real funds were transferred.',
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  })
);

router.get(
  '/mine',
  asyncRoute(async (req, res) => {
    const { rows } = await pool.query(
      `${paymentSelect} WHERE p.student_id=$1 ORDER BY p.created_at DESC`,
      [req.user.userId]
    );
    res.json({ payments: rows });
  })
);

module.exports = router;
