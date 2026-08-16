const multer = require('multer');

// Catches errors from asyncHandler-wrapped controllers, Multer, and
// anything else passed to next(err). Keeps error shape consistent
// across the whole listing API.
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  if (err && err.message && err.message.includes('images are allowed')) {
    return res.status(400).json({ error: err.message });
  }
  if (err && err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({ error: 'A record with these details already exists.' });
  }
  if (err && err.name === 'SequelizeValidationError') {
    return res.status(422).json({
      error: 'Validation failed.',
      details: err.errors.map((e) => ({ field: e.path, message: e.message })),
    });
  }

  console.error(err); // eslint-disable-line no-console
  return res.status(500).json({ error: 'Something went wrong on our end. Please try again.' });
}

module.exports = errorHandler;
