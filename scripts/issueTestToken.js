/**
 * Dev/testing helper only — NOT part of the real auth flow.
 * The real login endpoint (accounts module) should issue tokens the
 * same way: jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET).
 *
 * Usage:
 *   node scripts/issueTestToken.js <userId> <role>
 *   node scripts/issueTestToken.js 6c9b... advertiser
 */
require('dotenv').config();
const jwt = require('jsonwebtoken');

const [, , userId, role = 'advertiser'] = process.argv;

if (!userId) {
  console.error('Usage: node scripts/issueTestToken.js <userId> <role>');
  process.exit(1);
}

const token = jwt.sign({ sub: userId, role }, process.env.JWT_SECRET, {
  expiresIn: process.env.JWT_EXPIRES_IN || '7d',
});

console.log(token);
