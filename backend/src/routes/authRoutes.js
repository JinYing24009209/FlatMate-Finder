const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { auth, fail } = require('../middleware/auth');
const { asyncRoute } = require('../middleware/errorHandler');
const publicUser = (u) => ({
  user_id: u.user_id,
  full_name: u.full_name,
  email: u.email,
  role: u.role,
  phone: u.phone,
  is_active: u.is_active,
});
const cookieOptions = () => ({
  httpOnly: true,
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 604800000,
});
const issueSession = (res, user) =>
  res.cookie(
    'token',
    jwt.sign({ userId: user.user_id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    }),
    cookieOptions()
  );

router.post(
  '/register',
  asyncRoute(async (req, res) => {
    const { full_name, email, password, role = 'student', phone, admin_invite_code } = req.body;
    if (!full_name || !email || !password || !['student', 'advertiser', 'admin'].includes(role))
      return fail(res, 400, 'Name, email, password and a valid role are required.');
    if (password.length < 8) return fail(res, 400, 'Password must be at least 8 characters.');
    if (role === 'admin') {
      if (!admin_invite_code)
        return fail(res, 403, 'An internal admin invitation code is required.');
      const {
        rows: [invite],
      } = await pool.query(
        'SELECT * FROM admin_invite WHERE code=$1 AND is_active=true AND (expires_at IS NULL OR expires_at>now())',
        [admin_invite_code.trim()]
      );
      if (!invite || (invite.max_uses && invite.used_count >= invite.max_uses))
        return fail(res, 403, 'This admin invitation code is invalid, expired or fully used.');
      await pool.query('UPDATE admin_invite SET used_count=used_count+1 WHERE invite_id=$1', [
        invite.invite_id,
      ]);
    }
    const { rows: exists } = await pool.query('SELECT 1 FROM users WHERE lower(email)=lower($1)', [
      email,
    ]);
    if (exists.length) return fail(res, 409, 'This email is already registered.');
    const password_hash = await bcrypt.hash(password, 12);
    const {
      rows: [user],
    } = await pool.query(
      'INSERT INTO users (full_name,email,password_hash,role,phone) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [full_name.trim(), email.trim().toLowerCase(), password_hash, role, phone || null]
    );
    issueSession(res, user);
    res.status(201).json({ message: 'Account created.', user: publicUser(user) });
  })
);
router.post(
  '/login',
  asyncRoute(async (req, res) => {
    const { email, password } = req.body;
    const {
      rows: [user],
    } = await pool.query('SELECT * FROM users WHERE lower(email)=lower($1)', [email || '']);
    if (!user || !user.is_active || !(await bcrypt.compare(password || '', user.password_hash)))
      return fail(res, 401, 'Invalid email or password.');
    issueSession(res, user);
    res.json({ message: 'Welcome back.', user: publicUser(user) });
  })
);
router.post('/logout', (_req, res) => {
  res.clearCookie('token', cookieOptions());
  res.json({ message: 'Logged out.' });
});
router.get(
  '/me',
  auth,
  asyncRoute(async (req, res) => {
    const {
      rows: [user],
    } = await pool.query('SELECT * FROM users WHERE user_id=$1', [req.user.userId]);
    if (!user) return fail(res, 404, 'User not found.');
    res.json({ user: publicUser(user) });
  })
);
router.patch(
  '/me',
  auth,
  asyncRoute(async (req, res) => {
    const fullName = req.body.full_name?.trim();
    if (!fullName) return fail(res, 400, 'Full name is required.');
    const {
      rows: [user],
    } = await pool.query('UPDATE users SET full_name=$1,phone=$2 WHERE user_id=$3 RETURNING *', [
      fullName,
      req.body.phone?.trim() || null,
      req.user.userId,
    ]);
    res.json({ message: 'Account details updated.', user: publicUser(user) });
  })
);
module.exports = router;
