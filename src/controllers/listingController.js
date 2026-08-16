const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');
const { Listing, ListingPhoto, User, sequelize } = require('../models');
const asyncHandler = require('../utils/asyncHandler');

// Allowed forward transitions for listing status.
// Prevents e.g. moving a closed listing straight back to "available"
// by accident, or publishing a listing that was never filled in.
const ALLOWED_TRANSITIONS = {
  draft: ['available'],
  available: ['shortlisted', 'filled', 'closed'],
  shortlisted: ['available', 'filled', 'closed'],
  filled: ['closed', 'available'],
  closed: ['available'],
};

function toPublicListing(listing) {
  const json = listing.toJSON();
  return {
    id: json.id,
    advertiserId: json.advertiserId,
    advertiser: json.advertiser
      ? { id: json.advertiser.id, fullName: json.advertiser.fullName }
      : undefined,
    title: json.title,
    weeklyRent: Number(json.weeklyRent),
    bond: json.bond !== null ? Number(json.bond) : null,
    roomType: json.roomType,
    availableFrom: json.availableFrom,
    address: json.address,
    suburb: json.suburb,
    latitude: json.latitude !== null ? Number(json.latitude) : null,
    longitude: json.longitude !== null ? Number(json.longitude) : null,
    description: json.description,
    houseRules: json.houseRules,
    amenities: json.amenities,
    transportOptions: json.transportOptions,
    status: json.status,
    publishedAt: json.publishedAt,
    photos: (json.photos || [])
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((p) => ({ id: p.id, url: p.url, sortOrder: p.sortOrder })),
    createdAt: json.createdAt,
    updatedAt: json.updatedAt,
  };
}

/**
 * POST /api/listings
 * Creates a new listing owned by the logged-in advertiser.
 * body.publish=true publishes immediately (status "available");
 * otherwise the listing is saved as a "draft" — matches the
 * "Save draft" / "Publish listing" buttons in the UI.
 */
const createListing = asyncHandler(async (req, res) => {
  const {
    title, weeklyRent, bond, roomType, availableFrom,
    address, suburb, latitude, longitude,
    description, houseRules, amenities, transportOptions, publish,
  } = req.body;

  const listing = await Listing.create({
    advertiserId: req.user.id,
    title,
    weeklyRent,
    bond: bond ?? null,
    roomType,
    availableFrom,
    address,
    suburb,
    latitude: latitude ?? null,
    longitude: longitude ?? null,
    description: description ?? null,
    houseRules: houseRules ?? null,
    amenities: amenities ?? [],
    transportOptions: transportOptions ?? [],
    status: publish ? 'available' : 'draft',
    publishedAt: publish ? new Date() : null,
  });

  return res.status(201).json({ listing: toPublicListing(listing) });
});

/**
 * PUT /api/listings/:id
 * Edits a listing. Only the owning advertiser (or an admin) may edit it.
 */
const updateListing = asyncHandler(async (req, res) => {
  const listing = await Listing.findByPk(req.params.id);
  if (!listing) return res.status(404).json({ error: 'Listing not found.' });

  if (listing.advertiserId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'You can only edit your own listings.' });
  }

  const editable = [
    'title', 'weeklyRent', 'bond', 'roomType', 'availableFrom',
    'address', 'suburb', 'latitude', 'longitude',
    'description', 'houseRules', 'amenities', 'transportOptions',
  ];
  editable.forEach((field) => {
    if (req.body[field] !== undefined) listing[field] = req.body[field];
  });

  await listing.save();
  return res.json({ listing: toPublicListing(listing) });
});

/**
 * PATCH /api/listings/:id/status
 * Publishes a draft, or moves an existing listing between
 * available / shortlisted / filled / closed.
 */
const updateListingStatus = asyncHandler(async (req, res) => {
  const listing = await Listing.findByPk(req.params.id);
  if (!listing) return res.status(404).json({ error: 'Listing not found.' });

  if (listing.advertiserId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'You can only manage your own listings.' });
  }

  const { status: nextStatus } = req.body;
  const allowedNext = ALLOWED_TRANSITIONS[listing.status] || [];
  if (!allowedNext.includes(nextStatus)) {
    return res.status(409).json({
      error: `Cannot move a "${listing.status}" listing to "${nextStatus}".`,
      allowedNext,
    });
  }

  listing.status = nextStatus;
  if (nextStatus === 'available' && !listing.publishedAt) {
    listing.publishedAt = new Date();
  }
  await listing.save();

  return res.json({ listing: toPublicListing(listing) });
});

/**
 * POST /api/listings/:id/photos
 * Attaches uploaded photos (multer) to a listing, preserving upload order.
 */
const addListingPhotos = asyncHandler(async (req, res) => {
  const listing = await Listing.findByPk(req.params.id);
  if (!listing) return res.status(404).json({ error: 'Listing not found.' });

  if (listing.advertiserId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'You can only manage your own listings.' });
  }

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No image files were uploaded.' });
  }

  const existingCount = await ListingPhoto.count({ where: { listingId: listing.id } });

  const photos = await Promise.all(
    req.files.map((file, i) =>
      ListingPhoto.create({
        listingId: listing.id,
        url: `/uploads/listings/${file.filename}`,
        sortOrder: existingCount + i,
      })
    )
  );

  return res.status(201).json({
    photos: photos.map((p) => ({ id: p.id, url: p.url, sortOrder: p.sortOrder })),
  });
});

/**
 * DELETE /api/listings/:id/photos/:photoId
 */
const deleteListingPhoto = asyncHandler(async (req, res) => {
  const listing = await Listing.findByPk(req.params.id);
  if (!listing) return res.status(404).json({ error: 'Listing not found.' });

  if (listing.advertiserId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'You can only manage your own listings.' });
  }

  const photo = await ListingPhoto.findOne({
    where: { id: req.params.photoId, listingId: listing.id },
  });
  if (!photo) return res.status(404).json({ error: 'Photo not found on this listing.' });

  const filePath = path.join(process.cwd(), photo.url.replace(/^\//, ''));
  await photo.destroy();
  fs.unlink(filePath, () => {}); // best-effort cleanup, ignore errors

  return res.status(204).send();
});

/**
 * GET /api/listings/mine
 * Advertiser dashboard: all listings they own, newest first.
 */
const getMyListings = asyncHandler(async (req, res) => {
  const listings = await Listing.findAll({
    where: { advertiserId: req.user.id },
    include: [{ model: ListingPhoto, as: 'photos' }],
    order: [['createdAt', 'DESC']],
  });
  return res.json({ listings: listings.map(toPublicListing) });
});

/**
 * GET /api/listings/:id
 * Public detail view. Draft listings are only visible to their owner/admin.
 */
const getListingById = asyncHandler(async (req, res) => {
  const listing = await Listing.findByPk(req.params.id, {
    include: [
      { model: ListingPhoto, as: 'photos' },
      { model: User, as: 'advertiser', attributes: ['id', 'fullName'] },
    ],
  });
  if (!listing) return res.status(404).json({ error: 'Listing not found.' });

  const isOwnerOrAdmin =
    req.user && (req.user.id === listing.advertiserId || req.user.role === 'admin');
  if (listing.status === 'draft' && !isOwnerOrAdmin) {
    return res.status(404).json({ error: 'Listing not found.' });
  }

  return res.json({ listing: toPublicListing(listing) });
});

/**
 * GET /api/listings
 * Public browse/search endpoint (paginated). Only published listings
 * (never "draft") are ever returned here.
 */
const listListings = asyncHandler(async (req, res) => {
  const page = req.query.page || 1;
  const pageSize = req.query.pageSize || 12;

  const where = { status: { [Op.ne]: 'draft' } };
  if (req.query.status) where.status = req.query.status;
  if (req.query.suburb) where.suburb = { [Op.iLike]: `%${req.query.suburb}%` };
  if (req.query.roomType) where.roomType = req.query.roomType;
  if (req.query.minRent || req.query.maxRent) {
    where.weeklyRent = {};
    if (req.query.minRent) where.weeklyRent[Op.gte] = req.query.minRent;
    if (req.query.maxRent) where.weeklyRent[Op.lte] = req.query.maxRent;
  }
  if (req.query.keyword) {
    where[Op.or] = [
      { title: { [Op.iLike]: `%${req.query.keyword}%` } },
      { description: { [Op.iLike]: `%${req.query.keyword}%` } },
    ];
  }

  const { rows, count } = await Listing.findAndCountAll({
    where,
    include: [{ model: ListingPhoto, as: 'photos' }],
    order: [['publishedAt', 'DESC']],
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  return res.json({
    listings: rows.map(toPublicListing),
    pagination: { page, pageSize, total: count, totalPages: Math.ceil(count / pageSize) },
  });
});

/**
 * DELETE /api/listings/:id
 */
const deleteListing = asyncHandler(async (req, res) => {
  const listing = await Listing.findByPk(req.params.id);
  if (!listing) return res.status(404).json({ error: 'Listing not found.' });

  if (listing.advertiserId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'You can only delete your own listings.' });
  }

  await sequelize.transaction(async (t) => {
    await ListingPhoto.destroy({ where: { listingId: listing.id }, transaction: t });
    await listing.destroy({ transaction: t });
  });

  return res.status(204).send();
});

module.exports = {
  createListing,
  updateListing,
  updateListingStatus,
  addListingPhotos,
  deleteListingPhoto,
  getMyListings,
  getListingById,
  listListings,
  deleteListing,
};
