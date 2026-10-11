const express = require('express');
const { pool } = require('../config/database');
const { auth, fail } = require('../middleware/auth');
const { asyncRoute } = require('../middleware/errorHandler');
const { enhancedFlatmateMatchScore } = require('../services/aiService');
const { aiRateLimit } = require('../middleware/aiRateLimit');
const {transaction}=require('../services/transaction');
const {notify}=require('../services/notificationService');
const v=require('../services/validation');
const profiles = express.Router();
const conversations = express.Router();
const studentAccess = asyncRoute(async (req, res, next) => {
  const {
    rows: [user],
  } = await pool.query(
    "SELECT 1 FROM users WHERE user_id=$1 AND role='student' AND student_type='flatmate' AND is_active=true",
    [req.user.userId]
  );
  if (!user) return fail(res, 403, 'A flatmate student account is required.');
  next();
});
profiles.use(auth, studentAccess);
conversations.use(auth, studentAccess);
const validId = (value) => Number.isSafeInteger(Number(value)) && Number(value) > 0;
const messageBody = (value) => (typeof value === 'string' ? value.trim() : '');

async function targetProfile(id, currentId) {
  const {
    rows: [profile],
  } = await pool.query(
    `
    SELECT u.user_id,u.full_name,p.profile_photo,p.about_me,p.budget_min,p.budget_max,
      p.preferred_location,p.preferred_city,p.preferred_suburb,p.move_in_flexible,p.lifestyle_tags,p.study_habits,p.contact_preference,
      to_char(p.move_in_date,'YYYY-MM-DD') AS move_in_date,
      EXISTS(SELECT 1 FROM saved_flatmate s WHERE s.student_id=$2 AND s.saved_user_id=u.user_id) AS is_saved
    FROM users u JOIN profiles p ON p.user_id=u.user_id
    WHERE u.user_id=$1 AND u.user_id<>$2 AND u.role='student'
      AND u.student_type='flatmate' AND u.is_active=true AND (p.visible_for_matching=true OR EXISTS(
        SELECT 1 FROM flatmate_conversation c WHERE c.member_low=LEAST($1::int,$2::int)
        AND c.member_high=GREATEST($1::int,$2::int) AND c.low_agreed AND c.high_agreed))`,
    [id, currentId]
  );
  return profile;
}
async function conversation(id, userId) {
  const {
    rows: [row],
  } = await pool.query(
    `SELECT * FROM flatmate_conversation
    WHERE conversation_id=$1 AND $2 IN (member_low,member_high)`,
    [id, userId]
  );
  return row;
}
async function insertMessage(client, row, sender, body) {
  const {
    rows: [message],
  } = await client.query(
    `INSERT INTO flatmate_message(conversation_id,sender_id,body)
    VALUES($1,$2,$3) RETURNING *`,
    [row.conversation_id, sender, body]
  );
  await client.query('UPDATE flatmate_conversation SET updated_at=now() WHERE conversation_id=$1', [
    row.conversation_id,
  ]);
  const recipient = row.member_low === sender ? row.member_high : row.member_low;
  await client.query(
    `INSERT INTO notification(user_id,type,message,related_entity_type,related_entity_id)
    VALUES($1,'message','You have a new flatmate message.','flatmate_conversation',$2)`,
    [recipient, row.conversation_id]
  );
  return message;
}
profiles.get('/matched',asyncRoute(async(req,res)=>{
  const {rows}=await pool.query(`SELECT u.user_id,u.full_name,p.profile_photo,p.about_me,p.preferred_location,
    p.budget_min,p.budget_max,p.lifestyle_tags,p.study_habits,c.conversation_id,c.matched_at,true AS mutually_agreed
    FROM flatmate_conversation c JOIN users u ON u.user_id=CASE WHEN c.member_low=$1 THEN c.member_high ELSE c.member_low END
    LEFT JOIN profiles p ON p.user_id=u.user_id
    WHERE $1 IN(c.member_low,c.member_high) AND c.low_agreed AND c.high_agreed AND u.is_active
    ORDER BY c.matched_at DESC,c.conversation_id DESC`,[req.user.userId]);
  res.json({matches:rows});
}));
profiles.get(
  '/:id',
  aiRateLimit,
  asyncRoute(async (req, res) => {
    if (!validId(req.params.id)) return fail(res, 400, 'Invalid profile.');
    const profile = await targetProfile(req.params.id, req.user.userId);
    if (!profile) return fail(res, 404, 'This flatmate profile is no longer available.');
    const {
      rows: [mine],
    } = await pool.query('SELECT * FROM profiles WHERE user_id=$1', [req.user.userId]);
    const match = await enhancedFlatmateMatchScore(mine, profile);
    res.json({
      flatmate: {
        ...profile,
        compatibility_score: match.score,
        score_breakdown: match.breakdown,
        score_source: match.mode,
      },
    });
  })
);
profiles.post(
  '/:id/enquiries',
  asyncRoute(async (req, res) => {
    const body = messageBody(req.body.body);
    if (!validId(req.params.id)) return fail(res, 400, 'Invalid profile.');
    if (!body || body.length > 3000)
      return fail(res, 400, 'Write a message between 1 and 3000 characters.');
    if (!(await targetProfile(req.params.id, req.user.userId)))
      return fail(res, 404, 'This flatmate profile is no longer available.');
    const members = [req.user.userId, Number(req.params.id)].sort((a, b) => a - b);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const {
        rows: [row],
      } = await client.query(
        `INSERT INTO flatmate_conversation(member_low,member_high)
      VALUES($1,$2) ON CONFLICT(member_low,member_high) DO UPDATE SET updated_at=now() RETURNING *`,
        members
      );
      await insertMessage(client, row, req.user.userId, body);
      await client.query('COMMIT');
      res.status(201).json({ conversation_id: row.conversation_id });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  })
);
conversations.get(
  '/',
  asyncRoute(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT c.conversation_id,c.updated_at,c.matched_at,
    CASE WHEN c.member_low=$1 THEN c.low_agreed ELSE c.high_agreed END AS my_agreed,
    CASE WHEN c.member_low=$1 THEN c.high_agreed ELSE c.low_agreed END AS other_agreed,
    u.full_name,u.user_id AS other_user_id,
    p.profile_photo,
    (SELECT body FROM flatmate_message WHERE conversation_id=c.conversation_id ORDER BY created_at DESC,message_id DESC LIMIT 1) AS last_message,
    (SELECT count(*)::int FROM flatmate_message WHERE conversation_id=c.conversation_id AND sender_id<>$1 AND read_at IS NULL) AS unread_count
    FROM flatmate_conversation c JOIN users u ON u.user_id=CASE WHEN c.member_low=$1 THEN c.member_high ELSE c.member_low END
    LEFT JOIN profiles p ON p.user_id=u.user_id WHERE $1 IN (c.member_low,c.member_high)
    ORDER BY c.updated_at DESC,c.conversation_id DESC`,
      [req.user.userId]
    );
    res.json({ conversations: rows });
  })
);
conversations.patch('/:id/agreement',asyncRoute(async(req,res)=>{
  if(!validId(req.params.id)||typeof req.body.agreed!=='boolean')throw v.invalid('Choose agreed or not agreed.');
  const result=await transaction(async client=>{
    const {rows:[old]}=await client.query(`SELECT * FROM flatmate_conversation WHERE conversation_id=$1
      AND $2 IN(member_low,member_high) FOR UPDATE`,[req.params.id,req.user.userId]);
    if(!old)throw v.invalid('Conversation not found.',404);
    const low=old.member_low===req.user.userId;
    const recipient=low?old.member_high:old.member_low;
    if(req.body.agreed){
      const other=await client.query("SELECT 1 FROM users WHERE user_id=$1 AND is_active AND role='student' AND student_type='flatmate'",[recipient]);
      if(!other.rowCount)throw v.invalid('This account is no longer available for matching.',409);
    }
    const mine=low?old.low_agreed:old.high_agreed;
    if(mine===req.body.agreed)return old;
    const {rows:[row]}=await client.query(`UPDATE flatmate_conversation SET
      low_agreed=CASE WHEN member_low=$2 THEN $3 ELSE low_agreed END,
      high_agreed=CASE WHEN member_high=$2 THEN $3 ELSE high_agreed END,
      matched_at=CASE WHEN $3 AND (CASE WHEN member_low=$2 THEN high_agreed ELSE low_agreed END)
        THEN COALESCE(matched_at,now()) ELSE NULL END,updated_at=now()
      WHERE conversation_id=$1 RETURNING *`,[old.conversation_id,req.user.userId,req.body.agreed]);
    await notify(recipient,'flatmate_agreement',row.low_agreed&&row.high_agreed?'You both agreed to be flatmates. Your match is confirmed.':req.body.agreed?'Your conversation partner agreed to be flatmates.':'Your conversation partner withdrew their agreement.',
      'flatmate_conversation',row.conversation_id,client);
    return row;
  });
  res.json({my_agreed:result.member_low===req.user.userId?result.low_agreed:result.high_agreed,
    other_agreed:result.member_low===req.user.userId?result.high_agreed:result.low_agreed,matched_at:result.matched_at});
}));
conversations.get(
  '/:id/messages',
  asyncRoute(async (req, res) => {
    if (!validId(req.params.id) || !(await conversation(req.params.id, req.user.userId)))
      return fail(res, 404, 'Conversation not found.');
    const { rows } = await pool.query(
      `SELECT m.*,u.full_name AS sender_name FROM flatmate_message m
    JOIN users u ON u.user_id=m.sender_id WHERE conversation_id=$1 ORDER BY created_at,message_id`,
      [req.params.id]
    );
    res.json({ messages: rows });
  })
);
conversations.patch(
  '/:id/read',
  asyncRoute(async (req, res) => {
    if (!validId(req.params.id) || !(await conversation(req.params.id, req.user.userId)))
      return fail(res, 404, 'Conversation not found.');
    await pool.query(
      'UPDATE flatmate_message SET read_at=now() WHERE conversation_id=$1 AND sender_id<>$2 AND read_at IS NULL',
      [req.params.id, req.user.userId]
    );
    await pool.query(
      "UPDATE notification SET is_read=true WHERE user_id=$1 AND related_entity_type='flatmate_conversation' AND related_entity_id=$2",
      [req.user.userId, req.params.id]
    );
    res.json({ message: 'Conversation read.' });
  })
);
conversations.post(
  '/:id/messages',
  asyncRoute(async (req, res) => {
    const body = messageBody(req.body.body);
    if (!body || body.length > 3000)
      return fail(res, 400, 'Write a message between 1 and 3000 characters.');
    const row = validId(req.params.id) && (await conversation(req.params.id, req.user.userId));
    if (!row) return fail(res, 404, 'Conversation not found.');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const message = await insertMessage(client, row, req.user.userId, body);
      await client.query('COMMIT');
      res.status(201).json({ message });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  })
);
module.exports = { profiles, conversations };
