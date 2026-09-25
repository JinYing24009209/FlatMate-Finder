require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { pool } = require('./src/config/database');
const { errorHandler } = require('./src/middleware/errorHandler');

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '8mb' })); // photo data URLs are stored in PostgreSQL for the coursework demo
app.use(cookieParser());

app.get('/api/health', async (_req, res, next) => {
  try { await pool.query('SELECT 1'); res.json({ status: 'ok' }); } catch (error) { next(error); }
});
app.use('/api/auth', require('./src/routes/authRoutes'));
app.use('/api/profile', require('./src/routes/profileRoutes'));
app.use('/api/listings', require('./src/routes/listingRoutes'));
app.use('/api', require('./src/routes/communityRoutes'));
app.use('/api', require('./src/routes/aiRoutes'));
app.use('/api/admin', require('./src/routes/adminRoutes'));
app.use(errorHandler);

const port = Number(process.env.PORT || 5000);
app.listen(port, () => console.log(`FlatMate Finder API listening on ${port}`));
