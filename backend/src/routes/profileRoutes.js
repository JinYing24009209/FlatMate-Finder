const router = require('express').Router();
const { pool } = require('../config/database');
const { auth, fail } = require('../middleware/auth');
const { asyncRoute } = require('../middleware/errorHandler');
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
router.put(
  '/me',
  auth,
  asyncRoute(async (req, res) => {
    const p = req.body;
    if (p.budget_min && p.budget_max && Number(p.budget_min) > Number(p.budget_max))
      return fail(res, 400, 'Minimum budget cannot exceed maximum budget.');
    const sql = `
      INSERT INTO profiles (
        user_id, budget_min, budget_max, preferred_location, lifestyle_tags,
        study_habits, contact_preference, move_in_date, visible_for_matching,
        advertiser_bio, display_phone
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11)
      ON CONFLICT(user_id) DO UPDATE SET
        budget_min = EXCLUDED.budget_min,
        budget_max = EXCLUDED.budget_max,
        preferred_location = EXCLUDED.preferred_location,
        lifestyle_tags = EXCLUDED.lifestyle_tags,
        study_habits = EXCLUDED.study_habits,
        contact_preference = EXCLUDED.contact_preference,
        move_in_date = EXCLUDED.move_in_date,
        visible_for_matching = EXCLUDED.visible_for_matching,
        advertiser_bio = EXCLUDED.advertiser_bio,
        display_phone = EXCLUDED.display_phone
      RETURNING *, to_char(move_in_date, 'YYYY-MM-DD') AS move_in_date
    `;
    const {
      rows: [profile],
    } = await pool.query(sql, [
      req.user.userId,
      p.budget_min || null,
      p.budget_max || null,
      p.preferred_location || null,
      JSON.stringify(p.lifestyle_tags || []),
      p.study_habits || null,
      p.contact_preference || 'Email',
      p.move_in_date || null,
      p.visible_for_matching !== false,
      p.advertiser_bio || null,
      p.display_phone !== false,
    ]);
    res.json({ message: 'Profile saved.', profile });
  })
);
module.exports = router;
