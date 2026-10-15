// Authentication and role-based access middleware.
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const fail = (res, status, message) => res.status(status).json({ message });

// Verify the session token and attach the authenticated user to the request.
async function auth(req, res, next) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
  // Reject requests that do not include a session token.
  if (!token) return fail(res, 401, 'Please log in first.');
  let claims;
  try {
    // JWT verification also checks the token expiry.
    claims = jwt.verify(token, process.env.JWT_SECRET);
    if (!Number.isSafeInteger(claims.userId) || claims.userId <= 0)
      throw new Error('Invalid user ID');
  } catch {
    return fail(res, 401, 'Your session is invalid or has expired.');
  }
  try {
    const {
      rows: [user],
    } = await pool.query('SELECT user_id,role,student_type,is_active FROM users WHERE user_id=$1', [
      claims.userId,
    ]);
    if (!user || !user.is_active) {
      res.clearCookie('token', {
        httpOnly: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        secure: process.env.NODE_ENV === 'production',
      });
      return res.status(401).json({
        code: 'ACCOUNT_INACTIVE',
        message: 'Your account is unavailable. Please contact an administrator.',
      });
    }
    req.user = { userId: user.user_id, role: user.role, student_type: user.student_type };
    return next();
  } catch (error) {
    return next(error);
  }
}

// Continue only when the authenticated role is allowed.
const allow =
  (...roles) =>
  (req, res, next) =>
    roles.includes(req.user.role)
      ? next()
      : fail(res, 403, 'You do not have permission for this action.');
module.exports = { auth, allow, fail };
