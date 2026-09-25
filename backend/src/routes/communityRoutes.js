const router = require('express').Router();
const { pool } = require('../config/database');
const { auth, allow, fail } = require('../middleware/auth');
const { asyncRoute } = require('../middleware/errorHandler');
const { notify } = require('../services/notificationService');
const { flatmateMatchScore } = require('../services/aiService');
const compactSelect = `
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
  '/saved',
  auth,
  allow('student'),
  asyncRoute(async (req, res) => {
    const { rows } = await pool.query(
      `${compactSelect}
        JOIN saved_listing s ON s.listing_id = l.listing_id
        WHERE s.student_id = $1
        GROUP BY l.listing_id, u.full_name
        ORDER BY max(s.saved_at) DESC`,
      [req.user.userId]
    );
    res.json({ listings: rows });
  })
);

router.get(
  '/enquiries',
  auth,
  asyncRoute(async (req, res) => {
    const person =
      req.user.role === 'student' ? 'u.full_name advertiser_name' : 'u.full_name student_name';
    const join =
      req.user.role === 'student'
        ? 'JOIN users u ON u.user_id=l.advertiser_id'
        : 'JOIN users u ON u.user_id=e.student_id';
    const where = req.user.role === 'student' ? 'e.student_id=$1' : 'l.advertiser_id=$1';
    const { rows } = await pool.query(
      `
        SELECT e.*, l.title, ${person},
          (
            SELECT count(*)::int
            FROM enquiry_message m
            WHERE m.enquiry_id = e.enquiry_id
              AND m.sender_id <> $1
              AND m.read_at IS NULL
          ) unread_count
        FROM enquiry e
        JOIN listing l ON l.listing_id = e.listing_id
        ${join}
        WHERE ${where}
        ORDER BY e.updated_at DESC
      `,
      [req.user.userId]
    );
    res.json({ enquiries: rows });
  })
);
async function accessibleEnquiry(id, user) {
  const {
    rows: [enquiry],
  } = await pool.query(
    `
      SELECT e.*, l.advertiser_id, l.title
      FROM enquiry e
      JOIN listing l ON l.listing_id = e.listing_id
      WHERE e.enquiry_id = $1
    `,
    [id]
  );
  if (!enquiry) return null;
  if (
    user.role !== 'admin' &&
    enquiry.student_id !== user.userId &&
    enquiry.advertiser_id !== user.userId
  )
    return 'forbidden';
  return enquiry;
}
router.get(
  '/enquiries/:id/messages',
  auth,
  asyncRoute(async (req, res) => {
    const enquiry = await accessibleEnquiry(req.params.id, req.user);
    if (!enquiry) return fail(res, 404, 'Conversation not found.');
    if (enquiry === 'forbidden') return fail(res, 403, 'This conversation is private.');
    await pool.query(
      'UPDATE enquiry_message SET read_at=now() WHERE enquiry_id=$1 AND sender_id<>$2 AND read_at IS NULL',
      [req.params.id, req.user.userId]
    );
    await pool.query(
      `
        UPDATE notification SET is_read = true
        WHERE user_id = $1
          AND related_entity_type = 'enquiry'
          AND related_entity_id = $2
      `,
      [req.user.userId, req.params.id]
    );
    const { rows } = await pool.query(
      `
        SELECT m.*, u.full_name sender_name
        FROM enquiry_message m
        JOIN users u ON u.user_id = m.sender_id
        WHERE m.enquiry_id = $1
        ORDER BY m.created_at
      `,
      [req.params.id]
    );
    res.json({ enquiry, messages: rows });
  })
);
router.post(
  '/enquiries/:id/messages',
  auth,
  asyncRoute(async (req, res) => {
    const enquiry = await accessibleEnquiry(req.params.id, req.user);
    const body = req.body.body?.trim();
    if (!enquiry) return fail(res, 404, 'Conversation not found.');
    if (enquiry === 'forbidden') return fail(res, 403, 'This conversation is private.');
    if (!body) return fail(res, 400, 'Message cannot be empty.');
    const {
      rows: [message],
    } = await pool.query(
      'INSERT INTO enquiry_message(enquiry_id,sender_id,body) VALUES($1,$2,$3) RETURNING *',
      [req.params.id, req.user.userId, body]
    );
    const other =
      req.user.userId === enquiry.student_id ? enquiry.advertiser_id : enquiry.student_id;
    await notify(
      other,
      'message',
      `New message about “${enquiry.title}”.`,
      'enquiry',
      enquiry.enquiry_id
    );
    res.status(201).json({ message });
  })
);
router.patch(
  '/enquiries/:id/status',
  auth,
  allow('advertiser', 'admin'),
  asyncRoute(async (req, res) => {
    const status = req.body.status;
    if (!['pending', 'accepted', 'declined'].includes(status))
      return fail(res, 400, 'Invalid status.');
    const enquiry = await accessibleEnquiry(req.params.id, req.user);
    if (!enquiry) return fail(res, 404, 'Enquiry not found.');
    if (
      enquiry === 'forbidden' ||
      (req.user.role !== 'admin' && enquiry.advertiser_id !== req.user.userId)
    )
      return fail(res, 403, 'Only the advertiser can change this status.');
    const {
      rows: [updated],
    } = await pool.query('UPDATE enquiry SET status=$1 WHERE enquiry_id=$2 RETURNING *', [
      status,
      req.params.id,
    ]);
    await notify(
      updated.student_id,
      'enquiry_update',
      `Your enquiry about “${enquiry.title}” is now ${status}.`,
      'enquiry',
      updated.enquiry_id
    );
    res.json({ message: `Enquiry ${status}.`, enquiry: updated });
  })
);
router.get(
  '/notifications',
  auth,
  asyncRoute(async (req, res) => {
    const { rows } = await pool.query(
      'SELECT * FROM notification WHERE user_id=$1 ORDER BY created_at DESC',
      [req.user.userId]
    );
    res.json({ notifications: rows });
  })
);
router.patch(
  '/notifications/:id/read',
  auth,
  asyncRoute(async (req, res) => {
    await pool.query(
      'UPDATE notification SET is_read=true WHERE notification_id=$1 AND user_id=$2',
      [req.params.id, req.user.userId]
    );
    res.json({ message: 'Notification read.' });
  })
);
router.get(
  '/unread-count',
  auth,
  asyncRoute(async (req, res) => {
    const {
      rows: [row],
    } = await pool.query(
      `
        SELECT count(*)::int unread
        FROM enquiry_message m
        JOIN enquiry e ON e.enquiry_id = m.enquiry_id
        JOIN listing l ON l.listing_id = e.listing_id
        WHERE m.sender_id <> $1
          AND m.read_at IS NULL
          AND (e.student_id = $1 OR l.advertiser_id = $1)
      `,
      [req.user.userId]
    );
    res.json(row);
  })
);
async function loadMatches(userId, filters = {}, savedOnly = false) {
  const {
    rows: [mine],
  } = await pool.query('SELECT * FROM profiles WHERE user_id=$1', [userId]);
  const { q = '', location = '', maxBudget = '' } = filters;
  const { rows } = await pool.query(
    `
      SELECT u.user_id, u.full_name, p.budget_min, p.budget_max,
        p.preferred_location, p.lifestyle_tags, p.study_habits,
        p.contact_preference, (sf.saved_user_id IS NOT NULL) is_saved
      FROM users u
      JOIN profiles p ON p.user_id = u.user_id
      LEFT JOIN saved_flatmate sf
        ON sf.student_id = $1 AND sf.saved_user_id = u.user_id
      WHERE u.role = 'student'
        AND u.is_active = true
        AND u.user_id <> $1
        AND p.visible_for_matching = true
        AND ($2 = '' OR u.full_name ILIKE $2 OR p.lifestyle_tags::text ILIKE $2)
        AND ($3 = '' OR p.preferred_location ILIKE $3)
        AND ($4::numeric IS NULL OR p.budget_min IS NULL OR p.budget_min <= $4)
        AND ($5 = false OR sf.saved_user_id IS NOT NULL)
    `,
    [
      userId,
      q ? `%${q}%` : '',
      location ? `%${location}%` : '',
      Number(maxBudget) || null,
      savedOnly,
    ]
  );
  const profileComplete = Boolean(
    mine?.preferred_location ||
      mine?.study_habits ||
      (mine?.lifestyle_tags || []).length ||
      mine?.budget_min ||
      mine?.budget_max
  );
  const matches = rows
    .map((candidate) => {
      const result = flatmateMatchScore(mine, candidate);
      return {
        ...candidate,
        compatibility_score: result.score,
        score_breakdown: result.breakdown,
        explanation:
          result.score == null
            ? 'Add your preferences before comparing compatibility.'
            : 'Calculated from the profile fields both students chose to share.',
      };
    })
    .sort((a, b) => (b.compatibility_score ?? -1) - (a.compatibility_score ?? -1));
  return { matches, profile_complete: profileComplete };
}

router.get(
  '/matches',
  auth,
  allow('student'),
  asyncRoute(async (req, res) => {
    const result = await loadMatches(req.user.userId, req.query);
    res.json(result);
  })
);

router.get(
  '/saved-flatmates',
  auth,
  allow('student'),
  asyncRoute(async (req, res) => {
    const result = await loadMatches(req.user.userId, {}, true);
    res.json(result);
  })
);

router.post(
  '/flatmates/:id/save',
  auth,
  allow('student'),
  asyncRoute(async (req, res) => {
    const savedUserId = Number(req.params.id);
    if (!savedUserId || savedUserId === req.user.userId)
      return fail(res, 400, 'Choose another student profile to save.');
    const { rows } = await pool.query(
      `
        SELECT 1
        FROM users u
        JOIN profiles p ON p.user_id = u.user_id
        WHERE u.user_id = $1
          AND u.role = 'student'
          AND u.is_active = true
          AND p.visible_for_matching = true
      `,
      [savedUserId]
    );
    if (!rows.length) return fail(res, 404, 'Flatmate profile not found.');
    await pool.query(
      `
        INSERT INTO saved_flatmate(student_id, saved_user_id)
        VALUES ($1, $2)
        ON CONFLICT(student_id, saved_user_id) DO NOTHING
      `,
      [req.user.userId, savedUserId]
    );
    res.status(201).json({ message: 'Flatmate saved.' });
  })
);

router.delete(
  '/flatmates/:id/save',
  auth,
  allow('student'),
  asyncRoute(async (req, res) => {
    await pool.query('DELETE FROM saved_flatmate WHERE student_id=$1 AND saved_user_id=$2', [
      req.user.userId,
      req.params.id,
    ]);
    res.json({ message: 'Flatmate removed from saved profiles.' });
  })
);
module.exports = router;
