const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');
const { Listing, ListingPhoto, Amenity, TransportOption, User, sequelize } = require('../models');
const asyncHandler = require('../utils/asyncHandler');

// Allowed status transitions. There is no "draft" state in this schema —
// a listing is live the moment it's created — so this only governs moves
// between the four post-creation statuses.
const ALLOWED_TRANSITIONS = {
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
    description: json.description,
    rent: Number(json.rent),
    bond: json.bond !== null ? Number(json.bond) : null,
    address: json.address,
    suburb: json.suburb,
    city: json.city,
    roomType: json.roomType,
    bedrooms: json.bedrooms,
    bathrooms: json.bathrooms !== null ? Number(json.bathrooms) : null,
    houseRules: json.houseRules,
    utilities: json.utilities || {},
    availableFrom: json.availableFrom,
    status: json.status,
    amenities: (json.amenities || []).map((a) => a.name),
    transportOptions: (json.transportOptions || []).map((t) => t.name),
    photos: (json.photos || [])
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((p) => ({ id: p.id, url: p.photoUrl, displayOrder: p.displayOrder })),
    createdAt: json.createdAt,
    updatedAt: json.updatedAt,
  };
}

const listingIncludes = [
  { model: ListingPhoto, as: 'photos' },
  { model: Amenity, as: 'amenities', through: { attributes: [] } },
  { model: TransportOption, as: 'transportOptions', through: { attributes: [] } },
];

/**
 * Finds-or-creates each amenity/transport name and links it to the listing.
 * Runs inside the caller's transaction so a partial failure rolls back cleanly.
 */
async function syncTags(listing, { amenities, transportOptions }, t) {
  if (amenities !== undefined) {
    const rows = await Promise.all(
      amenities.map((name) => Amenity.findOrCreate({ where: { name }, transaction: t }))
    );
    await listing.setAmenities(rows.map(([row]) => row), { transaction: t });
  }
  if (transportOptions !== undefined) {
    const rows = await Promise.all(
      transportOptions.map((name) => TransportOption.findOrCreate({ where: { name }, transaction: t }))
    );
    await listing.setTransportOptions(rows.map(([row]) => row), { transaction: t });
  }
}

/**
 * POST /api/listings
 * Creates a new listing owned by the logged-in advertiser. There is no
 * draft stage in this schema — the listing is live immediately, with
 * status defaulting to "available" unless the caller specifies otherwise.
 */
const createListing = asyncHandler(async (req, res) => {
  const {
    title, description, rent, bond, address, suburb, city,
    roomType, bedrooms, bathrooms, houseRules, utilities, availableFrom,
    amenities, transportOptions, status,
  } = req.body;

  const listing = await sequelize.transaction(async (t) => {
    const created = await Listing.create(
      {
        advertiserId: req.user.id,
        title,
        description: description ?? null,
        rent,
        bond: bond ?? 0,
        address,
        suburb: suburb ?? null,
        city,
        roomType,
        bedrooms: bedrooms ?? null,
        bathrooms: bathrooms ?? null,
        houseRules: houseRules ?? null,
        utilities: utilities ?? null,
        availableFrom,
        status: status || 'available',
      },
      { transaction: t }
    );
    await syncTags(created, { amenities: amenities ?? [], transportOptions: transportOptions ?? [] }, t);
    return created;
  });

  const full = await Listing.findByPk(listing.id, { include: listingIncludes });
  return res.status(201).json({ listing: toPublicListing(full) });
});

/**
 * PUT /api/listings/:id
 */
const updateListing = asyncHandler(async (req, res) => {
  const listing = await Listing.findByPk(req.params.id);
  if (!listing) return res.status(404).json({ error: 'Listing not found.' });

  if (listing.advertiserId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'You can only edit your own listings.' });
  }

  const editable = [
    'title', 'description', 'rent', 'bond', 'address', 'suburb', 'city',
    'roomType', 'bedrooms', 'bathrooms', 'houseRules', 'utilities', 'availableFrom',
  ];

  await sequelize.transaction(async (t) => {
    editable.forEach((field) => {
      if (req.body[field] !== undefined) listing[field] = req.body[field];
    });
    await listing.save({ transaction: t });
    await syncTags(listing, req.body, t);
  });

  const full = await Listing.findByPk(listing.id, { include: listingIncludes });
  return res.json({ listing: toPublicListing(full) });
});

/**
 * PATCH /api/listings/:id/status
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
  await listing.save();

  const full = await Listing.findByPk(listing.id, { include: listingIncludes });
  return res.json({ listing: toPublicListing(full) });
});

/**
 * POST /api/listings/:id/photos
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
        photoUrl: `/uploads/listings/${file.filename}`,
        displayOrder: existingCount + i,
      })
    )
  );

  return res.status(201).json({
    photos: photos.map((p) => ({ id: p.id, url: p.photoUrl, displayOrder: p.displayOrder })),
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

  const filePath = path.join(process.cwd(), photo.photoUrl.replace(/^\//, ''));
  await photo.destroy();
  fs.unlink(filePath, () => {}); // best-effort cleanup

  return res.status(204).send();
});

/**
 * GET /api/listings/mine/list
 */
const getMyListings = asyncHandler(async (req, res) => {
  const listings = await Listing.findAll({
    where: { advertiserId: req.user.id },
    include: listingIncludes,
    order: [['createdAt', 'DESC']],
  });
  return res.json({ listings: listings.map(toPublicListing) });
});

/**
 * GET /api/listings/:id
 */
const getListingById = asyncHandler(async (req, res) => {
  const listing = await Listing.findByPk(req.params.id, {
    include: [...listingIncludes, { model: User, as: 'advertiser', attributes: ['id', 'fullName'] }],
  });
  if (!listing) return res.status(404).json({ error: 'Listing not found.' });

  return res.json({ listing: toPublicListing(listing) });
});

/**
 * GET /api/listings
 * Public browse/search endpoint (paginated).
 * NOTE: this schema has no "draft" status, so by default this hides only
 * "closed" listings from the public feed. Pass ?status=closed explicitly
 * (as the owner/admin) to see closed ones, or adjust this default if the
 * team wants closed listings publicly visible too.
 */
const listListings = asyncHandler(async (req, res) => {
  const page = req.query.page || 1;
  const pageSize = req.query.pageSize || 12;

  const where = {};
  where.status = req.query.status || { [Op.ne]: 'closed' };
  if (req.query.city) where.city = { [Op.iLike]: `%${req.query.city}%` };
  if (req.query.suburb) where.suburb = { [Op.iLike]: `%${req.query.suburb}%` };
  if (req.query.roomType) where.roomType = req.query.roomType;
  if (req.query.minRent || req.query.maxRent) {
    where.rent = {};
    if (req.query.minRent) where.rent[Op.gte] = req.query.minRent;
    if (req.query.maxRent) where.rent[Op.lte] = req.query.maxRent;
  }
  if (req.query.keyword) {
    where[Op.or] = [
      { title: { [Op.iLike]: `%${req.query.keyword}%` } },
      { description: { [Op.iLike]: `%${req.query.keyword}%` } },
    ];
  }

  const { rows, count } = await Listing.findAndCountAll({
    where,
    include: listingIncludes,
    order: [['createdAt', 'DESC']],
    limit: pageSize,
    offset: (page - 1) * pageSize,
    distinct: true, // required for correct count when joining belongsToMany
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

  // ON DELETE CASCADE on listing_photo / listing_amenity / listing_transport
  // means the DB cleans up the join rows itself — just delete the listing.
  await listing.destroy();

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
