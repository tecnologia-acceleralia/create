import { DataTypes } from 'sequelize';
import { enableTenantScoping } from '../utils/tenant-scoping.js';

export function EventAssetModel(sequelize) {
  const EventAsset = sequelize.define(
    'EventAsset',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true
      },
      tenant_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false
      },
      event_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: 'Nombre identificador del recurso (usado en marcadores)'
      },
      original_filename: {
        type: DataTypes.STRING(500),
        allowNull: false
      },
      s3_key: {
        type: DataTypes.STRING(1000),
        allowNull: false
      },
      url: {
        type: DataTypes.STRING(1000),
        allowNull: false
      },
      mime_type: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      file_size: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false
      },
      uploaded_by: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false
      },
      description: {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: 'Texto descriptivo del recurso que se mostrará en lugar de la URL completa'
      }
    },
    {
      tableName: 'event_assets',
      underscored: true,
      timestamps: true
    }
  );

  enableTenantScoping(EventAsset);

  return EventAsset;
}

