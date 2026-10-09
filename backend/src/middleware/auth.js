//C.中间件检查登录与角色是否合法 | C. Middleware for validating login and role permissions.
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const fail = (res, status, message) => res.status(status).json({ message });

//C01：验证令牌，检查是否处于登录成功的状态的辅助函数 | C01. Verify the token to check the authenticated session.
async function auth(req, res, next) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
  //是否有令牌 | Check whether a token exists.
  if (!token) return fail(res, 401, 'Please log in first.');
  let claims;
  try {
    //令牌是否合法是否过期 | Check token validity and expiry.
    claims = jwt.verify(token, process.env.JWT_SECRET);
    if (!Number.isSafeInteger(claims.userId) || claims.userId <= 0) throw new Error('Invalid user ID');
  } catch {
    return fail(res, 401, 'Your session is invalid or has expired.');
  }
  try {
    const { rows: [user] } = await pool.query('SELECT user_id,role,student_type,is_active FROM users WHERE user_id=$1', [claims.userId]);
    if (!user || !user.is_active) {
      res.clearCookie('token', { httpOnly: true, sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', secure: process.env.NODE_ENV === 'production' });
      return res.status(401).json({ code: 'ACCOUNT_INACTIVE', message: 'Your account is unavailable. Please contact an administrator.' });
    }
    req.user = { userId: user.user_id, role: user.role, student_type: user.student_type };
    return next();
  } catch (error) { return next(error); }
}
 
//C02：当前角色在允许列表中才继续执行 | C02. Continue only when the current role is allowed.
const allow =
  (...roles) =>
  (req, res, next) =>
    roles.includes(req.user.role)
      ? next()
      : fail(res, 403, 'You do not have permission for this action.');
module.exports = { auth, allow, fail };
