const router = require('express').Router();
const { pool } = require('../config/database');
const { auth, allow, fail } = require('../middleware/auth');
const { asyncRoute } = require('../middleware/errorHandler');
router.use(auth, allow('admin'));
router.get(
  '/stats',
  asyncRoute(async (_req, res) => {
    const {
      rows: [stats],
    } = await pool.query(
      `
        SELECT
          (SELECT count(*) FROM users) users,
          (SELECT count(*) FROM listing) listings,
          (SELECT count(*) FROM enquiry) enquiries,
          (SELECT count(*) FROM report WHERE status = 'pending') pending_reports,
          (SELECT count(*) FROM admin_invite WHERE is_active) active_invites
      `
    );
    res.json({ stats });
  })
);
router.get(
  '/reports',
  asyncRoute(async (_req, res) => {
    const { rows } = await pool.query(
      `
        SELECT r.*, u.full_name reporter_name, l.title listing_title
        FROM report r
        JOIN users u ON u.user_id = r.reporter_id
        LEFT JOIN listing l ON l.listing_id = r.listing_id
        ORDER BY r.created_at DESC
      `
    );
    res.json({ reports: rows });
  })
);
router.get(
  '/users',
  asyncRoute(async (_req, res) => {
    const { rows } = await pool.query(
      'SELECT user_id,full_name,email,role,is_active,created_at FROM users ORDER BY created_at DESC'
    );
    res.json({ users: rows });
  })
);
router.patch(
  '/users/:id',
  asyncRoute(async (req, res) => {
    if (typeof req.body.is_active !== 'boolean')
      return fail(res, 400, 'is_active must be boolean.');
    if (Number(req.params.id) === req.user.userId && !req.body.is_active)
      return fail(res, 400, 'You cannot deactivate your own administrator account.');
    const {
      rows: [user],
    } = await pool.query(
      'UPDATE users SET is_active=$1 WHERE user_id=$2 RETURNING user_id,full_name,email,role,is_active',
      [req.body.is_active, req.params.id]
    );
    if (!user) return fail(res, 404, 'User not found.');
    res.json({ message: 'User access updated.', user });
  })
);
router.get(
  '/listings',
  asyncRoute(async (_req, res) => {
    const { rows } = await pool.query(
      `
        SELECT l.listing_id, l.title, l.status, l.rent,
          u.full_name advertiser_name
        FROM listing l
        JOIN users u ON u.user_id = l.advertiser_id
        ORDER BY l.updated_at DESC
      `
    );
    res.json({ listings: rows });
  })
);
router.patch(
  '/listings/:id',
  asyncRoute(async (req, res) => {
    if (!['available', 'shortlisted', 'filled', 'closed'].includes(req.body.status))
      return fail(res, 400, 'Invalid listing status.');
    const {
      rows: [listing],
    } = await pool.query('UPDATE listing SET status=$1 WHERE listing_id=$2 RETURNING *', [
      req.body.status,
      req.params.id,
    ]);
    if (!listing) return fail(res, 404, 'Listing not found.');
    res.json({ message: 'Listing status updated.', listing });
  })
);
router.patch(
  '/reports/:id',
  asyncRoute(async (req, res) => {
    if (!['reviewed', 'dismissed'].includes(req.body.status))
      return fail(res, 400, 'Invalid report status.');
    const {
      rows: [report],
    } = await pool.query(
      'UPDATE report SET status=$1,reviewed_by=$2,reviewed_at=now() WHERE report_id=$3 RETURNING *',
      [req.body.status, req.user.userId, req.params.id]
    );
    res.json({ message: 'Report reviewed.', report });
  })
);
router.post(
  '/invites',
  asyncRoute(async (req, res) => {
    const { code, max_uses = 1, expires_at = null } = req.body;
    if (!code?.trim()) return fail(res, 400, 'Invitation code is required.');
    const {
      rows: [invite],
    } = await pool.query(
      'INSERT INTO admin_invite(code,max_uses,expires_at,created_by) VALUES($1,$2,$3,$4) RETURNING *',
      [code.trim(), max_uses, expires_at || null, req.user.userId]
    );
    res.status(201).json({ message: 'Admin invitation code created.', invite });
  })
);
module.exports = router;
