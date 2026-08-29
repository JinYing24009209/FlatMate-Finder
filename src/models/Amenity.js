const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

class Amenity extends Model {}

Amenity.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      field: 'amenity_id',
    },
    name: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  },
  {
    sequelize,
    modelName: 'Amenity',
    tableName: 'amenity',
    timestamps: false,
  }
);

module.exports = Amenity;
