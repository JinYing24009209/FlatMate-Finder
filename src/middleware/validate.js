const { validationResult } = require('express-validator');

/**
 * Runs after an express-validator chain. If any rule failed, responds
 * with 422 and a field-by-field error list instead of reaching the
 * controller — keeps controllers free of manual validation checks.
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      error: 'Validation failed.',
      details: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  return next();
}

module.exports = validate;
