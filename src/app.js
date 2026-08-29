const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const listingRoutes = require('./routes/listingRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(helmet({ crossOriginResourcePolicy: false })); // allow serving /uploads images
app.use(cors());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded listing photos statically, e.g. /uploads/listings/xxx.jpg
app.use('/uploads', express.static(path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads')));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/listings', listingRoutes);

app.use((req, res) => res.status(404).json({ error: 'Route not found.' }));
app.use(errorHandler);

module.exports = app;
