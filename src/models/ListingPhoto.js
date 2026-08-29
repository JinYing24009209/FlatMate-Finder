const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

class ListingPhoto extends Model {}

ListingPhoto.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      field: 'photo_id',
    },
    listingId: { type: DataTypes.INTEGER, allowNull: false, field: 'listing_id' },
    photoUrl: { type: DataTypes.STRING(500), allowNull: false, field: 'photo_url' },
    displayOrder: { type: DataTypes.INTEGER, defaultValue: 0, field: 'display_order' },
  },
  {
    sequelize,
    modelName: 'ListingPhoto',
    tableName: 'listing_photo',
    timestamps: false, // this table has no created_at / updated_at columns
    indexes: [{ fields: ['listing_id'] }],
  }
);

module.exports = ListingPhoto;
