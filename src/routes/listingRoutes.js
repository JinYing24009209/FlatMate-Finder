const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { uploadListingPhotos } = require('../middleware/upload');
const validate = require('../middleware/validate');
const {
  createListingRules,
  updateListingRules,
  statusUpdateRules,
  listingIdParamRule,
  listQueryRules,
} = require('../validators/listingValidators');
const ctrl = require('../controllers/listingController');

const router = express.Router();

// ---- Public browsing (no auth required) ----
router.get('/', listQueryRules, validate, ctrl.listListings);
router.get('/:id', listingIdParamRule, validate, ctrl.getListingById);

// ---- Advertiser-only management ----
router.use(requireAuth);

router.get('/mine/list', requireRole('advertiser', 'admin'), ctrl.getMyListings);

router.post(
  '/',
  requireRole('advertiser', 'admin'),
  createListingRules,
  validate,
  ctrl.createListing
);

router.put(
  '/:id',
  requireRole('advertiser', 'admin'),
  listingIdParamRule,
  updateListingRules,
  validate,
  ctrl.updateListing
);

router.patch(
  '/:id/status',
  requireRole('advertiser', 'admin'),
  listingIdParamRule,
  statusUpdateRules,
  validate,
  ctrl.updateListingStatus
);

router.post(
  '/:id/photos',
  requireRole('advertiser', 'admin'),
  listingIdParamRule,
  validate,
  uploadListingPhotos.array('photos', 8),
  ctrl.addListingPhotos
);

router.delete(
  '/:id/photos/:photoId',
  requireRole('advertiser', 'admin'),
  listingIdParamRule,
  validate,
  ctrl.deleteListingPhoto
);

router.delete(
  '/:id',
  requireRole('advertiser', 'admin'),
  listingIdParamRule,
  validate,
  ctrl.deleteListing
);

module.exports = router;
