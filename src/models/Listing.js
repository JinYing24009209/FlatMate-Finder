const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

const ROOM_TYPES = ['Single', 'Double', 'Studio'];
const LISTING_STATUSES = ['draft', 'available', 'shortlisted', 'filled', 'closed'];

class Listing extends Model {}

Listing.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    advertiserId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'advertiser_id',
    },

    // ----- Basics -----
    title: { type: DataTypes.STRING(150), allowNull: false },
    weeklyRent: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: false,
      field: 'weekly_rent',
      validate: { min: 0 },
    },
    bond: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true,
      validate: { min: 0 },
    },
    roomType: {
      type: DataTypes.ENUM(...ROOM_TYPES),
      allowNull: false,
      field: 'room_type',
    },
    availableFrom: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'available_from',
    },

    // ----- Location -----
    address: { type: DataTypes.STRING(200), allowNull: false },
    suburb: { type: DataTypes.STRING(100), allowNull: false },
    latitude: { type: DataTypes.DECIMAL(9, 6), allowNull: true },
    longitude: { type: DataTypes.DECIMAL(9, 6), allowNull: true },

    // ----- Description & rules -----
    description: { type: DataTypes.TEXT, allowNull: true },
    houseRules: { type: DataTypes.TEXT, allowNull: true, field: 'house_rules' },

    // ----- Amenities & transport (simple tag lists) -----
    amenities: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
      defaultValue: [],
    },
    transportOptions: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
      defaultValue: [],
      field: 'transport_options',
    },

    // ----- Status -----
    status: {
      type: DataTypes.ENUM(...LISTING_STATUSES),
      allowNull: false,
      defaultValue: 'draft',
    },
    publishedAt: { type: DataTypes.DATE, allowNull: true, field: 'published_at' },
  },
  {
    sequelize,
    modelName: 'Listing',
    tableName: 'listings',
    underscored: true,
    timestamps: true,
    indexes: [
      { fields: ['advertiser_id'] },
      { fields: ['status'] },
      { fields: ['suburb'] },
    ],
  }
);

Listing.ROOM_TYPES = ROOM_TYPES;
Listing.LISTING_STATUSES = LISTING_STATUSES;

module.exports = Listing;
