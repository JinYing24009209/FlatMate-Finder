//E. Saved items, enquiries, notifications and flatmates.
const router = require('express').Router();
const { pool } = require('../config/database');
const { auth, allow, fail } = require('../middleware/auth');
const { asyncRoute } = require('../middleware/errorHandler'); //Automatically forward asynchronous errors.
const { notify } = require('../services/notificationService');
const { enhancedFlatmateScores, enhancedFlatmateSearch } = require('../services/aiService');
const v = require('../services/validation');
const { transaction } = require('../services/transaction');
const { aiRateLimit } = require('../middleware/aiRateLimit');
const {keywords}=require('../services/listingFilters');
 
//E01. SQL template for listings, advertiser names and listing photos.
const compactSelect = `
  SELECT l.*, u.full_name advertiser_name,
    COALESCE(
      json_agg(p.photo_url ORDER BY p.display_order, p.photo_id) FILTER (WHERE p.photo_url IS NOT NULL),
      '[]'
    ) photos
  FROM listing l
  JOIN users u ON u.user_id = l.advertiser_id
  LEFT JOIN listing_photo p ON p.listing_id = l.listing_id
`;

//E02. Get the current student's saved listings.
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

//E03. Get the user's housing enquiries and the unread message count for each conversation.
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
      // Get the unread message count.
      `
        SELECT e.*, l.title, ${person},
          (
            SELECT count(*)::int
            FROM enquiry_message m
            WHERE m.enquiry_id = e.enquiry_id
            -- The message sender is not the current user.
              AND m.sender_id <> $1
              -- The message is unread.
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

//E04. Look up an enquiry and its listing, then check existence and access permissions.
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

//E05. Get all messages in an enquiry conversation.
router.get(
  '/enquiries/:id/messages',
  auth,
  asyncRoute(async (req, res) => {
    // Check access to the enquiry.
    const enquiry = await accessibleEnquiry(req.params.id, req.user);
    if (!enquiry) return fail(res, 404, 'Conversation not found.');
    if (enquiry === 'forbidden') return fail(res, 403, 'This conversation is private.');
    // Mark unread messages from the other participant in this enquiry as read.
    await pool.query(
      'UPDATE enquiry_message SET read_at=now() WHERE enquiry_id=$1 AND sender_id<>$2 AND read_at IS NULL',
      [req.params.id, req.user.userId]
    );
    //Mark the related notifications as read.
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

//E06. Send a message.
router.post(
  '/enquiries/:id/messages',
  auth,
  asyncRoute(async (req, res) => {
    //Check enquiry existence, access permission and non-empty message content.
    const enquiry = await accessibleEnquiry(req.params.id, req.user);
    const body = v.text(req.body.body, 'Message', 3000, true);
    if (!enquiry) return fail(res, 404, 'Conversation not found.');
    if (enquiry === 'forbidden') return fail(res, 403, 'This conversation is private.');
    if (!body) return fail(res, 400, 'Message cannot be empty.');
    //Insert the message into the database message table.
    const message = await transaction(async (client) => {
    await client.query('UPDATE enquiry SET updated_at=now() WHERE enquiry_id=$1', [req.params.id]);
    const {
      rows: [message],
    } = await client.query(
      'INSERT INTO enquiry_message(enquiry_id,sender_id,body) VALUES($1,$2,$3) RETURNING *',
      [req.params.id, req.user.userId, body]
    );
    //Identify the other participant.
    const other =
      req.user.userId === enquiry.student_id ? enquiry.advertiser_id : enquiry.student_id;
    //Notify the other participant about the new message.
    await notify(
      other,
      'message',
      `New message about “${enquiry.title}”.`,
      'enquiry',
      enquiry.enquiry_id,
      client
    );
    return message;
    });
    res.status(201).json({ message });
  })
);

//E07. Update enquiry status.
router.patch(
  '/enquiries/:id/status',
  auth,
  allow('advertiser', 'admin'),
  asyncRoute(async (req, res) => {
    //Read the requested new status.
    const status = req.body.status;
    //Validate the status.
    if (!['pending', 'accepted', 'declined'].includes(status))
      return fail(res, 400, 'Invalid status.');
    //Check access to the enquiry.
    const enquiry = await accessibleEnquiry(req.params.id, req.user);
    if (!enquiry) return fail(res, 404, 'Enquiry not found.');
    if (
      enquiry === 'forbidden' ||
      (req.user.role !== 'admin' && enquiry.advertiser_id !== req.user.userId)
    )
      return fail(res, 403, 'Only the advertiser can change this status.');
    // Update the status.
    const updated = await transaction(async (client) => {
    const {
      rows: [updated],
    } = await client.query('UPDATE enquiry SET status=$1,updated_at=now() WHERE enquiry_id=$2 RETURNING *', [
      status,
      req.params.id,
    ]);
    if (!updated) throw v.invalid('Enquiry not found.', 404);
    //Notify the student that the enquiry status has changed.
    await notify(
      updated.student_id,
      'enquiry_update',
      `Your enquiry about “${enquiry.title}” is now ${status}.`,
      'enquiry',
      updated.enquiry_id,
      client
    );
    return updated;
    });
    res.json({ message: `Enquiry ${status}.`, enquiry: updated });
  })
);

//E08. Get the notification list.
router.get(
  '/notifications',
  auth,
  asyncRoute(async (req, res) => {
    const { rows } = await pool.query(
      'SELECT * FROM notification WHERE user_id=$1 ORDER BY created_at DESC',
      [req.user.userId]
    );
    res.json({ notifications: rows, unread: rows.filter(item=>!item.is_read).length });
  })
);

//E09. Mark a notification as read.
router.patch(
  '/notifications/:id/read',
  auth,
  asyncRoute(async (req, res) => {
    const result=await pool.query(
      'UPDATE notification SET is_read=true WHERE notification_id=$1 AND user_id=$2 RETURNING notification_id',
      [req.params.id, req.user.userId]
    );
    if(!result.rowCount)return fail(res,404,'Notification not found.');
    res.json({ message: 'Notification read.' });
  })
);

//E10. Count unread housing enquiry and flatmate chat messages for the current user.
router.get(
  '/unread-count',
  auth,
  asyncRoute(async (req, res) => {
    // Count unread flatmate and housing enquiry messages separately, then add them together.
    // Count only unread messages sent by others in conversations involving the current user.
    const {
      rows: [row],
    } = await pool.query(
      `
        SELECT ((SELECT count(*) FROM flatmate_message fm
          JOIN flatmate_conversation fc ON fc.conversation_id=fm.conversation_id
          WHERE $1 IN (fc.member_low,fc.member_high) AND fm.sender_id<>$1 AND fm.read_at IS NULL)
          + count(*))::int unread
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

//E11. Load candidate flatmates and compute matches using the user, filters and saved-only mode.
async function loadMatches(userId, filters = {}, savedOnly = false) {
  const {
    rows: [mine],
    //Read the current user's profile.
  } = await pool.query('SELECT * FROM profiles WHERE user_id=$1', [userId]);
  // Read lifestyle keywords, location and budget filters.
  const q = v.text(filters.q, 'Search text', 1000);
  const location = v.text(filters.location, 'Location', 160);
  const city = v.text(filters.city, 'City', 120);
  const suburb = v.text(filters.suburb, 'Area or suburb', 120);
  if(suburb&&!city)throw v.invalid('Choose a city before choosing an area.');
  const maxBudget = v.number(filters.maxBudget, 'Maximum budget');
  const study=v.text(filters.studyHabits,'Study habits',160);
  const lifestyle=keywords(filters.lifestyle);
  const from=v.date(filters.moveInFrom,'Earliest move-in date');
  const to=v.date(filters.moveInTo,'Latest move-in date');
  if(from&&to&&from>to)throw v.invalid('Earliest move-in date cannot be after the latest date.');
  // Find eligible flatmate profiles and indicate whether the current user has saved each one.
  // When savedOnly is true, return only saved flatmates that still meet the visibility conditions.
  const { rows } = await pool.query(
    `
      SELECT u.user_id, u.full_name, p.budget_min, p.budget_max,
        p.preferred_location, p.preferred_city, p.preferred_suburb, p.move_in_flexible, p.lifestyle_tags, p.study_habits,
        p.contact_preference, p.profile_photo, p.about_me,
        to_char(p.move_in_date, 'YYYY-MM-DD') AS move_in_date,
        (sf.saved_user_id IS NOT NULL) is_saved
      FROM users u
      JOIN profiles p ON p.user_id = u.user_id
      LEFT JOIN saved_flatmate sf
        ON sf.student_id = $1 AND sf.saved_user_id = u.user_id
      WHERE u.role = 'student'
        AND u.student_type = 'flatmate'
        AND u.is_active = true
        AND u.user_id <> $1
        AND p.visible_for_matching = true
        AND ($2 = '' OR u.full_name ILIKE $2 OR p.lifestyle_tags::text ILIKE $2)
        AND ($3 = '' OR p.preferred_location ILIKE $3)
        AND ($4::numeric IS NULL OR p.budget_min IS NULL OR p.budget_min <= $4)
        AND ($5 = false OR sf.saved_user_id IS NOT NULL)
        AND ($6='' OR position(lower($6) in lower(COALESCE(p.study_habits,'')))>0)
        AND NOT EXISTS(SELECT 1 FROM unnest($7::text[]) wanted WHERE NOT EXISTS(
          SELECT 1 FROM jsonb_array_elements_text(p.lifestyle_tags) tag WHERE lower(tag)=wanted))
        AND ($8::date IS NULL OR p.move_in_flexible OR p.move_in_date >= $8::date)
        AND ($9::date IS NULL OR p.move_in_flexible OR p.move_in_date <= $9::date)
        AND ($10='' OR CASE WHEN p.preferred_city IS NOT NULL THEN lower(p.preferred_city)=lower($10)
          ELSE position(lower($10) in lower(COALESCE(p.preferred_location,'')))>0 END)
        AND ($11='' OR CASE WHEN p.preferred_city IS NOT NULL THEN lower(COALESCE(p.preferred_suburb,''))=lower($11)
          ELSE position(lower($11) in lower(COALESCE(p.preferred_location,'')))>0 END)
    `,
    [
      userId,
      q ? `%${q}%` : '',
      location ? `%${location}%` : '',
      maxBudget,
      savedOnly,
      study,lifestyle,from,to,city,suburb,
    ]
  );
  const profileComplete = Boolean(
    mine?.preferred_location ||
    mine?.study_habits ||
    (mine?.lifestyle_tags || []).length ||
    mine?.budget_min ||
    mine?.budget_max
  );
  const scores = await enhancedFlatmateScores(mine, rows);
  const matches = rows
    .map((candidate, index) => {
      const result = scores[index];
      return {
        ...candidate,
        compatibility_score: result.score,
        score_source: result.mode,
        score_breakdown: result.breakdown,
        explanation:
          result.score == null
            ? 'Add your preferences before comparing compatibility.'
            : result.mode === 'gemini'
              ? 'Gemini compared your shared accommodation preferences.'
              : 'Local preference scoring is active; Gemini is unavailable or not configured.',
      };
    })
    .sort((a, b) => (b.compatibility_score ?? -1) - (a.compatibility_score ?? -1));
  return { matches, profile_complete: profileComplete };
}

//E12. Return the flatmate matching list.
router.get('/matches/smart-search',auth,allow('student'),aiRateLimit,asyncRoute(async(req,res)=>{
  const interpretation=await enhancedFlatmateSearch(req.query.q);
  const result=await loadMatches(req.user.userId,interpretation);
  res.json({...result,interpretation,search_mode:interpretation.mode});
}));
router.get(
  '/matches',
  auth,
  allow('student'),
  aiRateLimit,
  asyncRoute(async (req, res) => {
    const result = await loadMatches(req.user.userId, req.query);
    res.json(result);
  })
);

//E13. Get saved flatmates.
router.get(
  '/saved-flatmates',
  auth,
  allow('student'),
  aiRateLimit,
  asyncRoute(async (req, res) => {
    const result = await loadMatches(req.user.userId, {}, true);
    res.json(result);
  })
);

// E14. Save a flatmate.
router.post(
  '/flatmates/:id/save',
  auth,
  allow('student'),
  asyncRoute(async (req, res) => {
    const savedUserId = Number(req.params.id);
    if (!savedUserId || savedUserId === req.user.userId)
      return fail(res, 400, 'Choose another student profile to save.');
    //Check the target flatmate profile in the database.
    const { rows } = await pool.query(
      `
        SELECT 1
        FROM users u
        JOIN profiles p ON p.user_id = u.user_id
        WHERE u.user_id = $1
          AND u.role = 'student'
          AND u.student_type = 'flatmate'
          AND u.is_active = true
          AND p.visible_for_matching = true
      `,
      [savedUserId]
    );
    if (!rows.length) return fail(res, 404, 'Flatmate profile not found.');
    // Store the relationship between the current user and the saved flatmate.
    // Do not insert a duplicate saved relationship.
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

//E15. Remove a flatmate from saved profiles.
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
