const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

class ListingPhoto extends Model {}

ListingPhoto.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    listingId: { type: DataTypes.UUID, allowNull: false, field: 'listing_id' },
    url: { type: DataTypes.STRING(500), allowNull: false },
    sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'sort_order' },
  },
  {
    sequelize,
    modelName: 'ListingPhoto',
    tableName: 'listing_photos',
    underscored: true,
    timestamps: true,
    indexes: [{ fields: ['listing_id'] }],
  }
);

module.exports = ListingPhoto;
