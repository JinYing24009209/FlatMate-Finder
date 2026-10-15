// Centralised asynchronous and HTTP error handling.
function errorHandler(error, _req, res, _next) {
  if ((error.status >= 400 && error.status < 500) || error.status === 503)
    return res
      .status(error.status)
      .json({ message: error.status === 413 ? 'Request is too large.' : error.message });
  if (error.code === '23505')
    return res.status(409).json({ message: 'This record already exists.' });
  if (['22P02', '22007', '22008', '22001', '23514', '23502'].includes(error.code))
    return res
      .status(400)
      .json({ message: 'Invalid input: check field types, lengths, dates and values.' });
  if (error.code === '23503')
    return res.status(409).json({ message: 'The referenced record no longer exists.' });
  // Keep diagnostic details in the server log.
  console.error(error);
  // Do not expose internal error details to clients.
  res.status(500).json({ message: 'Unexpected server error. Check the API terminal.' });
}
const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
module.exports = { errorHandler, asyncRoute };
