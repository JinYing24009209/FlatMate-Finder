const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

/**
 * Minimal User model — full profile fields (budget, lifestyle prefs, etc.)
 * belong to the accounts/profile module. Only what the listing module
 * needs (role-based access, ownership) is defined here.
 */
class User extends Model {}

User.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    fullName: { type: DataTypes.STRING(120), allowNull: false, field: 'full_name' },
    email: {
      type: DataTypes.STRING(160),
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
    },
    passwordHash: { type: DataTypes.STRING, allowNull: false, field: 'password_hash' },
    role: {
      type: DataTypes.ENUM('student', 'advertiser', 'admin'),
      allowNull: false,
      defaultValue: 'student',
    },
    phone: { type: DataTypes.STRING(30), allowNull: true },
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    underscored: true,
    timestamps: true,
  }
);

module.exports = User;
