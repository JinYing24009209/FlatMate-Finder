const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

class TransportOption extends Model {}

TransportOption.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      field: 'transport_id',
    },
    name: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  },
  {
    sequelize,
    modelName: 'TransportOption',
    tableName: 'transport_option',
    timestamps: false,
  }
);

module.exports = TransportOption;
