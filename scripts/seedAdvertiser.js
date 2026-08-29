/**
 * Dev/testing helper — creates one advertiser account so you can
 * exercise the listing endpoints before the accounts/registration
 * module exists. Not used in production.
 *
 * Usage: node scripts/seedAdvertiser.js
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize, User } = require('../src/models');

async function run() {
  const [user, created] = await User.findOrCreate({
    where: { email: 'advertiser@test.com' },
    defaults: {
      fullName: 'Test Advertiser',
      passwordHash: await bcrypt.hash('Password123!', 10),
      role: 'advertiser',
      phone: '+64 21 000 0000',
    },
  });

  console.log(created ? 'Created advertiser:' : 'Advertiser already existed:', {
    id: user.id, // this is the integer user_id
    email: user.email,
  });
  console.log(`\nGet a token with:\n  node scripts/issueTestToken.js ${user.id} advertiser`);

  await sequelize.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
