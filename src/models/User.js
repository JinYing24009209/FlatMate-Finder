const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

/**
 * Maps to the team's real `users` table. Only the columns this backend
 * actually touches are declared — full profile management (the `profiles`
 * table) belongs to the accounts module.
 */
class User extends Model {}

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      field: 'user_id',
    },
    fullName: { type: DataTypes.STRING(100), allowNull: false, field: 'full_name' },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
    },
    passwordHash: { type: DataTypes.STRING(255), allowNull: false, field: 'password_hash' },
    // DB enforces this with a CHECK constraint (not a Postgres ENUM type),
    // so we validate the same set at the application level.
    role: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: { isIn: [['student', 'advertiser', 'admin']] },
    },
    phone: { type: DataTypes.STRING(20), allowNull: true },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false, // users table has no updated_at column
  }
);

module.exports = User;
