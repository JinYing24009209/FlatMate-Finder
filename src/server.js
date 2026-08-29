require('dotenv').config();
const app = require('./app');
const { sequelize } = require('./models');

const PORT = process.env.PORT || 4000;

async function start() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established.');

    // IMPORTANT: sequelize.sync() is intentionally NOT called here.
    // The database schema (tables, the listing_status enum, triggers,
    // CHECK constraints) is owned and created by the team's own SQL —
    // not by these Sequelize models. Running sync({ alter: true })
    // against it would try to rename/recreate the listing_status type
    // and could silently break the update_listing_updated_at trigger.
    // These models exist purely to read/write the existing tables.

    app.listen(PORT, () => {
      console.log(`FlatMate Finder API listening on port ${PORT}`);
    });
  } catch (err) {
    console.error('Unable to start server:', err);
    process.exit(1);
  }
}

start();
