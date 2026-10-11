const router = require('express').Router();
const { pool } = require('../config/database');
const { auth, allow, fail } = require('../middleware/auth');
const { asyncRoute } = require('../middleware/errorHandler');
const {transaction}=require('../services/transaction');
const {notify,notifyListingChange}=require('../services/notificationService');
const v=require('../services/validation');
const {enhancedSafetyCheck}=require('../services/aiService');
const {aiRateLimit}=require('../middleware/aiRateLimit');
router.use(auth, allow('admin'));
router.post('/listings/:id/safety-check',aiRateLimit,asyncRoute(async(req,res)=>{
  if(!Number.isSafeInteger(Number(req.params.id))||Number(req.params.id)<=0)
    return fail(res,400,'Invalid listing ID.');
  const {rows:[listing]}=await pool.query('SELECT * FROM listing WHERE listing_id=$1',[req.params.id]);
  if(!listing)
    return fail(res,404,'Listing not found.');
  res.json({...await enhancedSafetyCheck(listing),checked_at:new Date().toISOString()});
}));
router.get('/users/:id', asyncRoute(async(req,res)=>{
  const {rows:[user]}=await pool.query(`SELECT u.user_id,u.full_name,u.role,u.is_active,u.student_type,
    p.profile_photo,p.contact_preference,p.visible_for_matching,p.about_me,p.advertiser_bio,p.preferred_location,p.study_habits,p.lifestyle_tags,p.move_in_date,
    p.preferred_city,p.preferred_suburb,p.move_in_flexible,p.budget_min,p.budget_max FROM users u LEFT JOIN profiles p USING(user_id) WHERE u.user_id=$1`,[req.params.id]);
  if(!user)
    return fail(res,404,'This user no longer exists. The report snapshot remains available.');
  res.json({user});
}));
router.get('/listings/:id', asyncRoute(async(req,res)=>{
  const {rows:[listing]}=await pool.query(`SELECT l.*,u.full_name advertiser_name,
    COALESCE((SELECT json_agg(photo_url ORDER BY display_order,photo_id) FROM listing_photo WHERE listing_id=l.listing_id),'[]') photos
    FROM listing l JOIN users u ON u.user_id=l.advertiser_id WHERE l.listing_id=$1`,[req.params.id]);
  if(!listing)
    return fail(res,404,'This listing no longer exists. The report snapshot remains available.');
  res.json({listing});
}));
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
    const [activity, statuses, studentNeeds, enquiries, reportOutcomes, successes] =
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
          `SELECT count(*)::int total,
            count(*) FILTER(WHERE resolution_action='close_listing')::int listing_upheld,
            count(*) FILTER(WHERE resolution_action='deactivate_user')::int user_upheld
            FROM report`
        ),
        pool.query(`SELECT (SELECT count(*)::int FROM listing WHERE status='filled') rented_homes,
          (SELECT count(DISTINCT u.user_id)::int FROM flatmate_conversation c
           JOIN users u ON u.user_id IN(c.member_low,c.member_high)
           JOIN users a ON a.user_id=c.member_low JOIN users b ON b.user_id=c.member_high
           WHERE c.low_agreed AND c.high_agreed AND a.is_active AND b.is_active
           AND a.role='student' AND b.role='student' AND a.student_type='flatmate' AND b.student_type='flatmate') matched_people`),
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
      report_outcomes: reportOutcomes.rows[0],
      success_outcomes: successes.rows[0],
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
    if(!before)
      throw v.invalid('Listing not found.',404);
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
      const {rows:[old]}=await client.query('SELECT * FROM report WHERE report_id=$1 FOR UPDATE',[req.params.id]);
      if(!old)
        throw v.invalid('Report not found.',404);
      if(old.status!=='pending')
        throw v.invalid('This report has already been processed; its original review is preserved.',409);
      let action=null;
      if(req.body.status==='reviewed'){
        if(old.target_type==='listing'){
          const {rows:[before]}=await client.query('SELECT * FROM listing WHERE listing_id=$1 FOR UPDATE',[old.listing_id]);
          if(!before)
            throw v.invalid('This listing was deleted. Dismiss the report with an explanation instead.',409);
          const {rows:[after]}=await client.query("UPDATE listing SET status='closed',updated_at=now() WHERE listing_id=$1 RETURNING *",[old.listing_id]);
          await notifyListingChange(client,before,after);
          action='close_listing';
        }else{
          if(old.reported_user_id===req.user.userId)
            throw v.invalid('You cannot deactivate your own administrator account.',400);
          const {rows:[target]}=await client.query('UPDATE users SET is_active=false WHERE user_id=$1 RETURNING user_id',[old.reported_user_id]);
          if(!target)
            throw v.invalid('This user was deleted. Dismiss the report with an explanation instead.',409);
          action='deactivate_user';
        }
      }
      const outcome=action?`${action==='close_listing'?'Listing taken down.':'User deactivated.'} ${note}`:note;
      const {rows:[updated]}=await client.query(`UPDATE report SET status=$1,reviewed_by=$2,reviewed_at=now(),resolution_note=$4,resolution_action=$5
        WHERE report_id=$3 RETURNING *`,[req.body.status,req.user.userId,req.params.id,outcome,action]);
      await notify(updated.reporter_id,'report_result',`Report #${updated.report_id} ${updated.status}: ${outcome}`.slice(0,500),'report',updated.report_id,client);
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
