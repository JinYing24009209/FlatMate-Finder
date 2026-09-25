const jwt = require('jsonwebtoken');
const fail = (res, status, message) => res.status(status).json({ message });
function auth(req, res, next) {
  const token = req.cookies.token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return fail(res, 401, 'Please log in first.');
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch {
    return fail(res, 401, 'Your session is invalid or has expired.');
  }
}
const allow =
  (...roles) =>
  (req, res, next) =>
    roles.includes(req.user.role)
      ? next()
      : fail(res, 403, 'You do not have permission for this action.');
module.exports = { auth, allow, fail };
