//E.收藏，咨询，通知，室友 | E. Saved items, enquiries, notifications and flatmates.
const router = require('express').Router();
const { pool } = require('../config/database');
const { auth, allow, fail } = require('../middleware/auth');
const { asyncRoute } = require('../middleware/errorHandler'); //自动捕获异步错误 | Automatically forward asynchronous errors.
const { notify } = require('../services/notificationService');
const { enhancedFlatmateScores } = require('../services/aiService');
const v = require('../services/validation');
const { transaction } = require('../services/transaction');
const { aiRateLimit } = require('../middleware/aiRateLimit');
const {keywords}=require('../services/listingFilters');
 
//E01：SQL模板，查询房源，发布者名字及房源照片 | E01. SQL template for listings, advertiser names and listing photos.
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

//E02：获取当前学生收藏的房源列表 | E02. Get the current student's saved listings.
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

//E03：获取当前用户的房源咨询列表，以及每个会话的未读消息数 | E03. Get the user's housing enquiries and the unread message count for each conversation.
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
      // 获得未读消息数 | Get the unread message count.
      `
        SELECT e.*, l.title, ${person},
          (
            SELECT count(*)::int
            FROM enquiry_message m
            WHERE m.enquiry_id = e.enquiry_id
            -- 发送咨询不是自己 | The message sender is not the current user.
              AND m.sender_id <> $1
              -- 咨询未读 | The message is unread.
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

//E04：辅助函数,查询针对一条咨询的房源和房子名字，检查咨询是否存在，角色是否正确 | E04. Look up an enquiry and its listing, then check existence and access permissions.
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

//E05：获得某个咨询会话的所有消息 | E05. Get all messages in an enquiry conversation.
router.get(
  '/enquiries/:id/messages',
  auth,
  asyncRoute(async (req, res) => {
    // 检查咨询是否合法 | Check access to the enquiry.
    const enquiry = await accessibleEnquiry(req.params.id, req.user);
    if (!enquiry) return fail(res, 404, 'Conversation not found.');
    if (enquiry === 'forbidden') return fail(res, 403, 'This conversation is private.');
    //合法的话将改咨询中对方给我发的，我未读的消息置为已读 | Mark unread messages from the other participant in this enquiry as read.
    await pool.query(
      'UPDATE enquiry_message SET read_at=now() WHERE enquiry_id=$1 AND sender_id<>$2 AND read_at IS NULL',
      [req.params.id, req.user.userId]
    );
    //将通知设为已读 | Mark the related notifications as read.
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

//E06：发送消息 | E06. Send a message.
router.post(
  '/enquiries/:id/messages',
  auth,
  asyncRoute(async (req, res) => {
    //检查咨询是否存在并合法，以及消息是否为空 | Check enquiry existence, access permission and non-empty message content.
    const enquiry = await accessibleEnquiry(req.params.id, req.user);
    const body = v.text(req.body.body, 'Message', 3000, true);
    if (!enquiry) return fail(res, 404, 'Conversation not found.');
    if (enquiry === 'forbidden') return fail(res, 403, 'This conversation is private.');
    if (!body) return fail(res, 400, 'Message cannot be empty.');
    //将输入的消息插入数据库的消息表单 | Insert the message into the database message table.
    const message = await transaction(async (client) => {
    await client.query('UPDATE enquiry SET updated_at=now() WHERE enquiry_id=$1', [req.params.id]);
    const {
      rows: [message],
    } = await client.query(
      'INSERT INTO enquiry_message(enquiry_id,sender_id,body) VALUES($1,$2,$3) RETURNING *',
      [req.params.id, req.user.userId, body]
    );
    //获取对面的身份 | Identify the other participant.
    const other =
      req.user.userId === enquiry.student_id ? enquiry.advertiser_id : enquiry.student_id;
    //通知对方有新消息 | Notify the other participant about the new message.
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

//E07：更新咨询状态 | E07. Update enquiry status.
router.patch(
  '/enquiries/:id/status',
  auth,
  allow('advertiser', 'admin'),
  asyncRoute(async (req, res) => {
    //获取输入的新状态 | Read the requested new status.
    const status = req.body.status;
    //检查状态是否合法 | Validate the status.
    if (!['pending', 'accepted', 'declined'].includes(status))
      return fail(res, 400, 'Invalid status.');
    //检查咨询是否合法 | Check access to the enquiry.
    const enquiry = await accessibleEnquiry(req.params.id, req.user);
    if (!enquiry) return fail(res, 404, 'Enquiry not found.');
    if (
      enquiry === 'forbidden' ||
      (req.user.role !== 'admin' && enquiry.advertiser_id !== req.user.userId)
    )
      return fail(res, 403, 'Only the advertiser can change this status.');
    //更新状态 | Update the status.
    const updated = await transaction(async (client) => {
    const {
      rows: [updated],
    } = await client.query('UPDATE enquiry SET status=$1,updated_at=now() WHERE enquiry_id=$2 RETURNING *', [
      status,
      req.params.id,
    ]);
    if (!updated) throw v.invalid('Enquiry not found.', 404);
    //通知该学生咨询状态已改变 | Notify the student that the enquiry status has changed.
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

//E08：获取通知列表 | E08. Get the notification list.
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

//E09：将通知标记为已读 | E09. Mark a notification as read.
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

//E10：统计当前用户未读的房源咨询消息数和室友聊天消息数 | E10. Count unread housing enquiry and flatmate chat messages for the current user.
router.get(
  '/unread-count',
  auth,
  asyncRoute(async (req, res) => {
    // 分别统计当前用户未读的室友聊天消息、房源咨询消息，将两者相加。 | Count unread flatmate and housing enquiry messages separately, then add them together.
    // 只统计自己参与的会话中，由别人发送且尚未阅读的消息。 | Count only unread messages sent by others in conversations involving the current user.
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

//E11:辅助函数：根据当前用户、搜索条件和收藏模式，读取候选室友并计算匹配结果。 | E11. Load candidate flatmates and compute matches using the user, filters and saved-only mode.
async function loadMatches(userId, filters = {}, savedOnly = false) {
  const {
    rows: [mine],
    //读取自己的资料 | Read the current user's profile.
  } = await pool.query('SELECT * FROM profiles WHERE user_id=$1', [userId]);
  // 读取生活习惯，位置，预算 | Read lifestyle keywords, location and budget filters.
  const q = v.text(filters.q, 'Search text', 1000);
  const location = v.text(filters.location, 'Location', 160);
  const maxBudget = v.number(filters.maxBudget, 'Maximum budget');
  const study=v.text(filters.studyHabits,'Study habits',160);
  const lifestyle=keywords(filters.lifestyle);
  const from=v.date(filters.moveInFrom,'Earliest move-in date');
  const to=v.date(filters.moveInTo,'Latest move-in date');
  if(from&&to&&from>to)throw v.invalid('Earliest move-in date cannot be after the latest date.');
  // 查询符合条件的室友资料，并标记当前用户是否已经收藏该室友。 | Find eligible flatmate profiles and indicate whether the current user has saved each one.
  // savedOnly 为 true 时，只返回已收藏且仍符合展示条件的室友。 | When savedOnly is true, return only saved flatmates that still meet the visibility conditions.
  const { rows } = await pool.query(
    `
      SELECT u.user_id, u.full_name, p.budget_min, p.budget_max,
        p.preferred_location, p.lifestyle_tags, p.study_habits,
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
        AND ($8::date IS NULL OR p.move_in_date >= $8::date)
        AND ($9::date IS NULL OR p.move_in_date <= $9::date)
    `,
    [
      userId,
      q ? `%${q}%` : '',
      location ? `%${location}%` : '',
      maxBudget,
      savedOnly,
      study,lifestyle,from,to,
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

//E12:获取匹配列表,返回匹配室友列表 | E12. Return the flatmate matching list.
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

//E13：获取已收藏的室友 | E13. Get saved flatmates.
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

//E14：收藏一个室友 | E14. Save a flatmate.
router.post(
  '/flatmates/:id/save',
  auth,
  allow('student'),
  asyncRoute(async (req, res) => {
    const savedUserId = Number(req.params.id);
    if (!savedUserId || savedUserId === req.user.userId)
      return fail(res, 400, 'Choose another student profile to save.');
    //数据库中查询要收藏的室友个人资料 | Check the target flatmate profile in the database.
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
    // 将“当前用户收藏目标室友”的关系写入收藏表。 | Store the relationship between the current user and the saved flatmate.
    // 如果同一收藏关系已经存在，则不重复添加。 | Do not insert a duplicate saved relationship.
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

//E15：取消收藏一个室友 | E15. Remove a flatmate from saved profiles.
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
