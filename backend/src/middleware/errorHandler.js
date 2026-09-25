function errorHandler(error, _req, res, _next) {
  console.error(error);
  res.status(500).json({ message: 'Unexpected server error. Check the API terminal.' });
}
const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
module.exports = { errorHandler, asyncRoute };
