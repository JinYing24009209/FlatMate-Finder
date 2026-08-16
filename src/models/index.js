const sequelize = require('../config/db');
const User = require('./User');
const Listing = require('./Listing');
const ListingPhoto = require('./ListingPhoto');

// A user (advertiser) can post many listings.
User.hasMany(Listing, { foreignKey: 'advertiserId', as: 'listings' });
Listing.belongsTo(User, { foreignKey: 'advertiserId', as: 'advertiser' });

// A listing can have many photos.
Listing.hasMany(ListingPhoto, {
  foreignKey: 'listingId',
  as: 'photos',
  onDelete: 'CASCADE',
});
ListingPhoto.belongsTo(Listing, { foreignKey: 'listingId', as: 'listing' });

module.exports = { sequelize, User, Listing, ListingPhoto };
