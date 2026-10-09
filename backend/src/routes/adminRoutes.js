const router = require('express').Router();
const { pool } = require('../config/database');
const { auth, allow, fail } = require('../middleware/auth');
const { asyncRoute } = require('../middleware/errorHandler');
const {transaction}=require('../services/transaction');
const {notify,notifyListingChange}=require('../services/notificationService');
const v=require('../services/validation');
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
  '/analytics',
  asyncRoute(async (req, res) => {
    const requestedDays = Number(req.query.days);
    const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 30;
    const [activity, statuses, studentNeeds, enquiries, flatmateEngagement] =
      await Promise.all([
        pool.query(
          `SELECT to_char(calendar.report_date::date,'YYYY-MM-DD') AS "day",
             count(l.listing_id)::int AS listings
           FROM generate_series(current_date - ($1::int - 1), current_date, interval '1 day')
             AS calendar(report_date)
           LEFT JOIN listing l ON l.created_at::date = calendar.report_date::date
           GROUP BY calendar.report_date ORDER BY calendar.report_date`,
          [days]
        ),
        pool.query(
          `SELECT status::text label, count(*)::int value FROM listing GROUP BY status ORDER BY status`
        ),
        pool.query(
          `SELECT student_type label, count(*)::int value
           FROM users WHERE role='student' GROUP BY student_type ORDER BY student_type`
        ),
        pool.query(
          `SELECT status::text label, count(*)::int value FROM enquiry GROUP BY status ORDER BY status`
        ),
        pool.query(
          `SELECT
             (SELECT count(*)::int FROM flatmate_conversation) conversations,
             (SELECT count(*)::int FROM flatmate_message) messages,
             (SELECT count(*)::int FROM profiles p JOIN users u ON u.user_id=p.user_id
               WHERE u.student_type='flatmate' AND p.visible_for_matching) visible_seekers`
        ),
      ]);
    res.json({
      range: {
        days,
        from: activity.rows[0]?.day,
        to: activity.rows.at(-1)?.day,
      },
      listings_by_day: activity.rows,
      listing_statuses: statuses.rows,
      student_needs: studentNeeds.rows.map((item) => ({
        ...item,
        label: item.label === 'flatmate' ? 'Seeking a flatmate' : 'Seeking a room',
      })),
      enquiry_outcomes: enquiries.rows,
      flatmate_engagement: flatmateEngagement.rows[0],
      generated_at: new Date().toISOString(),
    });
  })
);
router.get(
  '/reports',
  asyncRoute(async (_req, res) => {
    const { rows } = await pool.query(
      `
        SELECT r.*, u.full_name reporter_name, l.title listing_title, target.full_name reported_user_name
        FROM report r
        JOIN users u ON u.user_id = r.reporter_id
        LEFT JOIN listing l ON l.listing_id = r.listing_id
        LEFT JOIN users target ON target.user_id = r.reported_user_id
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
    const listing=await transaction(async client=>{
    const {rows:[before]}=await client.query('SELECT * FROM listing WHERE listing_id=$1 FOR UPDATE',[req.params.id]);
    if(!before)throw v.invalid('Listing not found.',404);
    const {
      rows: [listing],
    } = await client.query('UPDATE listing SET status=$1,updated_at=now() WHERE listing_id=$2 RETURNING *', [
      req.body.status,
      req.params.id,
    ]);
    await notifyListingChange(client,before,listing);
    return listing;
    });
    if (!listing) return fail(res, 404, 'Listing not found.');
    res.json({ message: 'Listing status updated.', listing });
  })
);
router.patch(
  '/reports/:id',
  asyncRoute(async (req, res) => {
    if (!['reviewed', 'dismissed'].includes(req.body.status))
      return fail(res, 400, 'Invalid report status.');
    const note=v.text(req.body.resolution_note,'Outcome explanation',1000) ||
      (req.body.status==='dismissed'?'The report was dismissed after review.':'The report has been reviewed by an administrator.');
    const report=await transaction(async client=>{
      const {rows:[old]}=await client.query(
        'SELECT * FROM report WHERE report_id=$1 FOR UPDATE',[req.params.id]);
      if(!old)
        throw v.invalid('Report not found.',404);
      if(old.status!=='pending')
        throw v.invalid('This report has already been processed; its original review is preserved.',409);
      const {rows:[updated]}=await client.query(`UPDATE report SET status=$1,reviewed_by=$2,reviewed_at=now(),resolution_note=$4
        WHERE report_id=$3 RETURNING *`,[req.body.status,req.user.userId,req.params.id,note]);
      await notify(updated.reporter_id,'report_result',`Report #${updated.report_id} 
        ${updated.status}: ${note}`.slice(0,500),'report',updated.report_id,client);
      return updated;
    });
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
