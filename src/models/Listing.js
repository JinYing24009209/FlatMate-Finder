const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// Matches the real `listing_status` Postgres enum — NOTE there is no
// "draft" value in the team's schema. A listing is live the moment it's
// created (default 'available'); there is no separate publish step.
const LISTING_STATUSES = ['available', 'shortlisted', 'filled', 'closed'];

// room_type is a plain varchar(50) in the DB (no CHECK constraint), so
// this list is an application-level convention, not a DB-enforced rule.
// Adjust freely if the team's frontend uses different labels.
const ROOM_TYPES = ['Single', 'Double', 'Studio'];

class Listing extends Model {}

Listing.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      field: 'listing_id',
    },
    advertiserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'advertiser_id',
    },

    title: { type: DataTypes.STRING(200), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },

    rent: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: { min: 0.01 },
    },
    bond: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
      validate: { min: 0 },
    },

    address: { type: DataTypes.STRING(200), allowNull: false },
    suburb: { type: DataTypes.STRING(100), allowNull: true },
    city: { type: DataTypes.STRING(100), allowNull: false },

    roomType: { type: DataTypes.STRING(50), allowNull: false, field: 'room_type' },
    bedrooms: { type: DataTypes.INTEGER, allowNull: true, validate: { min: 1 } },
    bathrooms: { type: DataTypes.DECIMAL(3, 1), allowNull: true, validate: { min: 0.1 } },

    houseRules: { type: DataTypes.TEXT, allowNull: true, field: 'house_rules' },
    // Free-form JSON, e.g. { "power": true, "water": true, "internet": false }
    utilities: { type: DataTypes.JSONB, allowNull: true },

    availableFrom: { type: DataTypes.DATEONLY, allowNull: false, field: 'available_from' },

    status: {
      type: DataTypes.ENUM(...LISTING_STATUSES),
      allowNull: false,
      defaultValue: 'available',
    },
  },
  {
    sequelize,
    modelName: 'Listing',
    tableName: 'listing',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at', // DB trigger also maintains this; Sequelize will just re-set it too
    indexes: [
      { fields: ['advertiser_id'] },
      { fields: ['city', 'status'] },
      { fields: ['available_from'] },
      { fields: ['rent'] },
    ],
  }
);

Listing.ROOM_TYPES = ROOM_TYPES;
Listing.LISTING_STATUSES = LISTING_STATUSES;

module.exports = Listing;
