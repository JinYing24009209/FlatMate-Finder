// Authentication and account-management routes.
const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { auth, fail } = require('../middleware/auth');
const { asyncRoute } = require('../middleware/errorHandler');
const v = require('../services/validation');
const { transaction } = require('../services/transaction');

// Return only account fields that the frontend needs.
const publicUser = (u) => ({
  user_id: u.user_id,
  full_name: u.full_name,
  email: u.email,
  role: u.role,
  student_type: u.student_type,
  phone: u.phone,
  is_active: u.is_active,
});

// Apply secure session-cookie defaults for the current environment.
const cookieOptions = () => ({
  httpOnly: true,
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 604800000,
});

// Sign the user identity and role, then store the token in an HTTP-only cookie.
const issueSession = (res, user) =>
  res.cookie(
    'token',
    jwt.sign({ userId: user.user_id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    }),
    cookieOptions()
  );

// Register a new account.
router.post(
  '/register',
  asyncRoute(async (req, res) => {
    // Validate public input before opening a database transaction.
    const input = v.object(req.body);
    const {
      full_name,
      email,
      password,
      role = 'student',
      phone,
      admin_invite_code,
      student_type,
    } = input;
    const name = v.text(full_name, 'Full name', 120, true);
    const address = v.text(email, 'Email', 254, true).toLowerCase();
    const phoneNumber = v.text(phone, 'Phone', 40);
    const inviteCode = v.text(admin_invite_code, 'Invitation code', 160);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))
      throw v.invalid('Enter a valid email address.');
    if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password) > 72)
      throw v.invalid('Password must contain at least 8 characters and at most 72 UTF-8 bytes.');

    const studentType = role === 'student' ? student_type : null;

    if (role === 'student' && !['housing', 'flatmate'].includes(studentType)) {
      return fail(res, 400, 'Please choose whether you are looking for housing or a flatmate.');
    }
    if (!full_name || !email || !password || !['student', 'advertiser', 'admin'].includes(role))
      return fail(res, 400, 'Name, email, password and a valid role are required.');
    if (password.length < 8) return fail(res, 400, 'Password must be at least 8 characters.');
    // Store a password hash rather than the original password.
    const password_hash = await bcrypt.hash(password, 12);
    // Commit invitation usage and account creation as one transaction.
    const user = await transaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [address]);
      const existing = await client.query('SELECT 1 FROM users WHERE lower(email)=lower($1)', [
        address,
      ]);
      if (existing.rowCount) throw v.invalid('This email is already registered.', 409);
      if (role === 'admin') {
        const invite = await client.query(
          `UPDATE admin_invite SET used_count=used_count+1
          WHERE code=$1 AND is_active=true AND (expires_at IS NULL OR expires_at>now())
          AND (max_uses IS NULL OR used_count<max_uses) RETURNING invite_id`,
          [inviteCode]
        );
        if (!invite.rowCount)
          throw v.invalid('This admin invitation code is invalid, expired or fully used.', 403);
      }
      // Save the validated account and return its public fields.
      const {
        rows: [user],
      } = await client.query(
        `INSERT INTO users
        (full_name, email, password_hash, role, phone, student_type)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
        [name, address, password_hash, role, phoneNumber || null, studentType]
      );
      return user;
    });
    issueSession(res, user);
    res.status(201).json({ message: 'Account created.', user: publicUser(user) });
  })
);

// Authenticate an existing account.
router.post(
  '/login',
  asyncRoute(async (req, res) => {
    const { email, password } = req.body;
    v.text(email, 'Email', 254, true);
    v.text(password, 'Password', 200, true);
    const {
      rows: [user],
      // Look up the account by its normalised email address.
    } = await pool.query('SELECT * FROM users WHERE lower(email)=lower($1)', [email || '']);
    // Require an active account and a matching password hash.
    if (!user || !user.is_active || !(await bcrypt.compare(password || '', user.password_hash)))
      return fail(res, 401, 'Invalid email or password.');
    issueSession(res, user);
    res.json({ message: 'Welcome back.', user: publicUser(user) });
  })
);

// Log out by clearing the session cookie.
router.post('/logout', (_req, res) => {
  res.clearCookie('token', cookieOptions());
  res.json({ message: 'Logged out.' });
});

// Return the authenticated user's account details.
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

// Update the authenticated user's editable account fields.
router.patch(
  '/me',
  auth,
  asyncRoute(async (req, res) => {
    // Validate changes before writing them to the database.
    const fullName = v.text(req.body.full_name, 'Full name', 120, true);
    if (!fullName) return fail(res, 400, 'Full name is required.');
    // Return the updated public account fields.
    const {
      rows: [user],
    } = await pool.query('UPDATE users SET full_name=$1,phone=$2 WHERE user_id=$3 RETURNING *', [
      fullName,
      v.text(req.body.phone, 'Phone', 40) || null,
      req.user.userId,
    ]);
    res.json({ message: 'Account details updated.', user: publicUser(user) });
  })
);
module.exports = router;
