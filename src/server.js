require('dotenv').config();
const app = require('./app');
const { sequelize } = require('./models');

const PORT = process.env.PORT || 4000;

async function start() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established.');

    // In development this keeps the schema in sync with the models.
    // In production, use the migrations in /migrations instead of sync().
    if (process.env.NODE_ENV !== 'production') {
      await sequelize.sync({ alter: true });
      console.log('Models synced.');
    }

    app.listen(PORT, () => {
      console.log(`FlatMate Finder API listening on port ${PORT}`);
    });
  } catch (err) {
    console.error('Unable to start server:', err);
    process.exit(1);
  }
}

start();
