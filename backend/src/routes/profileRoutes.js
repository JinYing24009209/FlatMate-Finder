//D.个人资料读取与修改 | D. Read and update personal profiles.
const router = require('express').Router();
const { pool } = require('../config/database');
const { auth, fail } = require('../middleware/auth');
const { asyncRoute } = require('../middleware/errorHandler');
const v = require('../services/validation');
 
//D01：读取个人资料 | D01. Read the personal profile.
router.get(
  '/me',
  auth,
  asyncRoute(async (req, res) => {
    const {
      rows: [profile],
    } = await pool.query(
      "SELECT *, to_char(move_in_date, 'YYYY-MM-DD') AS move_in_date FROM profiles WHERE user_id=$1",
      [req.user.userId]
    );
    res.json({ profile: profile || null });
  })
);

//D02：提交或更新个人资料 | D02. Create or update the personal profile.
router.put(
  '/me',
  auth,
  asyncRoute(async (req, res) => {
    const p = v.profile(req.body);
    //检查预算是否合法 | Validate the budget range.
    if (p.budget_min && p.budget_max && Number(p.budget_min) > Number(p.budget_max))
      return fail(res, 400, 'Minimum budget cannot exceed maximum budget.');
    //照片是否合法 | Validate the photo.
    const photo = p.profile_photo || null;
    if (
      photo &&
      (typeof photo !== 'string' ||
        photo.length > 1400000 ||
        !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(photo))
    )
      return fail(res, 400, 'Choose a JPEG, PNG or WebP profile photo below 1 MB.');
    // 检查简介的长度 | Check introduction length.
    if (p.about_me != null && (typeof p.about_me !== 'string' || p.about_me.length > 1000))
      return fail(res, 400, 'Your introduction must be at most 1000 characters.');
    //讲个人资料插入数据库 | Insert profile data into the database.
    //首次新增，已有则更新 | Insert a new profile or update an existing one.
    const sql = `
      INSERT INTO profiles (
        user_id, budget_min, budget_max, preferred_location, lifestyle_tags,
        study_habits, contact_preference, move_in_date, visible_for_matching,
        advertiser_bio, display_phone, profile_photo, about_me, preferred_city, preferred_suburb, move_in_flexible
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT(user_id) DO UPDATE SET
        budget_min = EXCLUDED.budget_min,
        budget_max = EXCLUDED.budget_max,
        preferred_location = EXCLUDED.preferred_location,
        lifestyle_tags = EXCLUDED.lifestyle_tags,
        study_habits = EXCLUDED.study_habits,
        contact_preference = EXCLUDED.contact_preference,
        move_in_date = EXCLUDED.move_in_date,
        move_in_flexible = EXCLUDED.move_in_flexible,
        preferred_city = EXCLUDED.preferred_city,
        preferred_suburb = EXCLUDED.preferred_suburb,
        visible_for_matching = EXCLUDED.visible_for_matching,
        advertiser_bio = EXCLUDED.advertiser_bio,
        display_phone = EXCLUDED.display_phone,
        profile_photo = EXCLUDED.profile_photo,
        about_me = EXCLUDED.about_me
      RETURNING *, to_char(move_in_date, 'YYYY-MM-DD') AS move_in_date
    `;
    //查询个人资料并返回前端结果 | Execute the profile write and return the resulting profile to the frontend.
    const {
      rows: [profile],
    } = await pool.query(sql, [
      req.user.userId,
      p.budget_min,
      p.budget_max,
      p.preferred_location || null,
      JSON.stringify(p.lifestyle_tags || []),
      p.study_habits || null,
      p.contact_preference || 'Email',
      p.move_in_date || null,
      p.visible_for_matching !== false,
      p.advertiser_bio || null,
      p.display_phone !== false,
      photo,
      p.about_me?.trim() || null,
      p.preferred_city || null,
      p.preferred_suburb || null,
      p.move_in_flexible,
    ]);
    res.json({ message: 'Profile saved.', profile });
  })
);
module.exports = router;
