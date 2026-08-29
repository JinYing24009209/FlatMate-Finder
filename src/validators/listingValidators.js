const { body, param, query } = require('express-validator');
const { Listing } = require('../models');

const createListingRules = [
  body('title')
    .trim()
    .notEmpty().withMessage('Listing title is required.')
    .isLength({ max: 200 }).withMessage('Title must be 200 characters or fewer.'),

  body('rent')
    .notEmpty().withMessage('Rent is required.')
    .isFloat({ gt: 0 }).withMessage('Rent must be a positive number.'),

  body('bond')
    .optional({ nullable: true })
    .isFloat({ min: 0 }).withMessage('Bond must be zero or a positive number.'),

  body('roomType')
    .notEmpty().withMessage('Room type is required.')
    .isLength({ max: 50 }).withMessage('Room type must be 50 characters or fewer.'),

  body('bedrooms')
    .optional({ nullable: true })
    .isInt({ min: 1 }).withMessage('Bedrooms must be a positive whole number.'),

  body('bathrooms')
    .optional({ nullable: true })
    .isFloat({ min: 0.1 }).withMessage('Bathrooms must be a positive number.'),

  body('availableFrom')
    .notEmpty().withMessage('Available-from date is required.')
    .isISO8601().withMessage('Available-from must be a valid date (YYYY-MM-DD).'),

  body('address').trim().notEmpty().withMessage('Address is required.'),
  body('city').trim().notEmpty().withMessage('City is required.'),
  body('suburb').optional({ nullable: true }).trim().isLength({ max: 100 }),

  body('description').optional({ nullable: true }).isLength({ max: 4000 }),
  body('houseRules').optional({ nullable: true }).isLength({ max: 2000 }),

  // Free-form key/value flags, e.g. { "power": true, "water": true }
  body('utilities').optional({ nullable: true }).isObject().withMessage('Utilities must be an object.'),

  // Sent as plain name strings — the controller finds-or-creates the
  // matching amenity/transport_option rows and links them.
  body('amenities').optional().isArray().withMessage('Amenities must be a list of strings.'),
  body('amenities.*').optional().isString().trim().isLength({ max: 100 }),

  body('transportOptions').optional().isArray().withMessage('Transport options must be a list of strings.'),
  body('transportOptions.*').optional().isString().trim().isLength({ max: 100 }),

  // No "draft" state exists in this schema — a listing is live on creation
  // (DB default: 'available'). Advertisers may only pick the initial status
  // explicitly if they want something other than the default.
  body('status').optional().isIn(Listing.LISTING_STATUSES)
    .withMessage(`Status must be one of: ${Listing.LISTING_STATUSES.join(', ')}`),
];

const updateListingRules = [
  body('title').optional().trim().isLength({ max: 200 }),
  body('rent').optional().isFloat({ gt: 0 }),
  body('bond').optional({ nullable: true }).isFloat({ min: 0 }),
  body('roomType').optional().isLength({ max: 50 }),
  body('bedrooms').optional({ nullable: true }).isInt({ min: 1 }),
  body('bathrooms').optional({ nullable: true }).isFloat({ min: 0.1 }),
  body('availableFrom').optional().isISO8601(),
  body('address').optional().trim().notEmpty(),
  body('city').optional().trim().notEmpty(),
  body('suburb').optional({ nullable: true }).trim().isLength({ max: 100 }),
  body('description').optional({ nullable: true }).isLength({ max: 4000 }),
  body('houseRules').optional({ nullable: true }).isLength({ max: 2000 }),
  body('utilities').optional({ nullable: true }).isObject(),
  body('amenities').optional().isArray(),
  body('amenities.*').optional().isString().trim().isLength({ max: 100 }),
  body('transportOptions').optional().isArray(),
  body('transportOptions.*').optional().isString().trim().isLength({ max: 100 }),
];

const statusUpdateRules = [
  body('status')
    .notEmpty().withMessage('Status is required.')
    .isIn(Listing.LISTING_STATUSES)
    .withMessage(`Status must be one of: ${Listing.LISTING_STATUSES.join(', ')}`),
];

// Primary keys are auto-increment integers in this schema, not UUIDs.
const listingIdParamRule = [param('id').isInt({ min: 1 }).withMessage('Invalid listing id.').toInt()];
const photoIdParamRule = [param('photoId').isInt({ min: 1 }).withMessage('Invalid photo id.').toInt()];

const listQueryRules = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('pageSize').optional().isInt({ min: 1, max: 50 }).toInt(),
  query('status').optional().isIn(Listing.LISTING_STATUSES),
];

module.exports = {
  createListingRules,
  updateListingRules,
  statusUpdateRules,
  listingIdParamRule,
  photoIdParamRule,
  listQueryRules,
};
