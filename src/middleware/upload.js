const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const uploadDir = path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads', 'listings');
fs.mkdirSync(uploadDir, { recursive: true });

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxSizeBytes = Number(process.env.MAX_UPLOAD_MB || 5) * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
    cb(null, uniqueName);
  },
});

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME.has(file.mimetype)) {
    return cb(new Error('Only JPEG, PNG or WEBP images are allowed.'));
  }
  return cb(null, true);
}

const uploadListingPhotos = multer({
  storage,
  fileFilter,
  limits: { fileSize: maxSizeBytes, files: 8 },
});

module.exports = { uploadListingPhotos, uploadDir };
