const { body, param, query } = require('express-validator');
const { Listing } = require('../models');

const createListingRules = [
  body('title')
    .trim()
    .notEmpty().withMessage('Listing title is required.')
    .isLength({ max: 150 }).withMessage('Title must be 150 characters or fewer.'),

  body('weeklyRent')
    .notEmpty().withMessage('Weekly rent is required.')
    .isFloat({ min: 0 }).withMessage('Weekly rent must be a positive number.'),

  body('bond')
    .optional({ nullable: true })
    .isFloat({ min: 0 }).withMessage('Bond must be a positive number.'),

  body('roomType')
    .notEmpty().withMessage('Room type is required.')
    .isIn(Listing.ROOM_TYPES).withMessage(`Room type must be one of: ${Listing.ROOM_TYPES.join(', ')}`),

  body('availableFrom')
    .notEmpty().withMessage('Available-from date is required.')
    .isISO8601().withMessage('Available-from must be a valid date (YYYY-MM-DD).'),

  body('address').trim().notEmpty().withMessage('Address is required.'),
  body('suburb').trim().notEmpty().withMessage('Suburb is required.'),

  body('latitude').optional({ nullable: true }).isFloat({ min: -90, max: 90 }),
  body('longitude').optional({ nullable: true }).isFloat({ min: -180, max: 180 }),

  body('description').optional({ nullable: true }).isLength({ max: 4000 }),
  body('houseRules').optional({ nullable: true }).isLength({ max: 2000 }),

  body('amenities').optional().isArray().withMessage('Amenities must be a list of strings.'),
  body('amenities.*').optional().isString().trim().isLength({ max: 60 }),

  body('transportOptions').optional().isArray().withMessage('Transport options must be a list of strings.'),
  body('transportOptions.*').optional().isString().trim().isLength({ max: 60 }),

  // Whether the advertiser wants to publish immediately or keep as draft.
  body('publish').optional().isBoolean().toBoolean(),
];

// Same field set but every field optional — used for PUT (edit) before publish.
const updateListingRules = [
  body('title').optional().trim().isLength({ max: 150 }),
  body('weeklyRent').optional().isFloat({ min: 0 }),
  body('bond').optional({ nullable: true }).isFloat({ min: 0 }),
  body('roomType').optional().isIn(Listing.ROOM_TYPES),
  body('availableFrom').optional().isISO8601(),
  body('address').optional().trim().notEmpty(),
  body('suburb').optional().trim().notEmpty(),
  body('latitude').optional({ nullable: true }).isFloat({ min: -90, max: 90 }),
  body('longitude').optional({ nullable: true }).isFloat({ min: -180, max: 180 }),
  body('description').optional({ nullable: true }).isLength({ max: 4000 }),
  body('houseRules').optional({ nullable: true }).isLength({ max: 2000 }),
  body('amenities').optional().isArray(),
  body('amenities.*').optional().isString().trim().isLength({ max: 60 }),
  body('transportOptions').optional().isArray(),
  body('transportOptions.*').optional().isString().trim().isLength({ max: 60 }),
];

const statusUpdateRules = [
  body('status')
    .notEmpty().withMessage('Status is required.')
    .isIn(Listing.LISTING_STATUSES)
    .withMessage(`Status must be one of: ${Listing.LISTING_STATUSES.join(', ')}`),
];

const listingIdParamRule = [param('id').isUUID().withMessage('Invalid listing id.')];

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
  listQueryRules,
};
