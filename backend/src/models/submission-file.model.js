import { DataTypes } from 'sequelize';
import { enableTenantScoping } from '../utils/tenant-scoping.js';

export function SubmissionFileModel(sequelize) {
  const SubmissionFile = sequelize.define(
    'SubmissionFile',
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
      submission_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false
      },
      url: {
        type: DataTypes.STRING(500),
        allowNull: false
      },
      storage_key: {
        type: DataTypes.STRING(500),
        allowNull: false
      },
      mime_type: {
        type: DataTypes.STRING(150),
        allowNull: false
      },
      size_bytes: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false
      },
      original_name: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      checksum: {
        type: DataTypes.STRING(128),
        allowNull: true
      }
    },
    {
      tableName: 'submission_files',
      underscored: true,
      timestamps: true
    }
  );

  enableTenantScoping(SubmissionFile);

  return SubmissionFile;
}

