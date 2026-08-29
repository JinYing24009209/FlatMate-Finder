const sequelize = require('../config/db');
const User = require('./User');
const Listing = require('./Listing');
const ListingPhoto = require('./ListingPhoto');
const Amenity = require('./Amenity');
const TransportOption = require('./TransportOption');

// advertiser (1) — (many) listings
User.hasMany(Listing, { foreignKey: 'advertiserId', as: 'listings' });
Listing.belongsTo(User, { foreignKey: 'advertiserId', as: 'advertiser' });

// listing (1) — (many) photos
Listing.hasMany(ListingPhoto, {
  foreignKey: 'listingId',
  as: 'photos',
  onDelete: 'CASCADE',
});
ListingPhoto.belongsTo(Listing, { foreignKey: 'listingId', as: 'listing' });

// listing (many) — (many) amenity, via the plain join table listing_amenity
Listing.belongsToMany(Amenity, {
  through: 'listing_amenity',
  foreignKey: 'listing_id',
  otherKey: 'amenity_id',
  as: 'amenities',
  timestamps: false,
});
Amenity.belongsToMany(Listing, {
  through: 'listing_amenity',
  foreignKey: 'amenity_id',
  otherKey: 'listing_id',
  as: 'listings',
  timestamps: false,
});

// listing (many) — (many) transport_option, via the plain join table listing_transport
Listing.belongsToMany(TransportOption, {
  through: 'listing_transport',
  foreignKey: 'listing_id',
  otherKey: 'transport_id',
  as: 'transportOptions',
  timestamps: false,
});
TransportOption.belongsToMany(Listing, {
  through: 'listing_transport',
  foreignKey: 'transport_id',
  otherKey: 'listing_id',
  as: 'listings',
  timestamps: false,
});

module.exports = { sequelize, User, Listing, ListingPhoto, Amenity, TransportOption };
