import { DataTypes } from 'sequelize';
import { enableTenantScoping } from '../utils/tenant-scoping.js';

export function SubmissionModel(sequelize) {
  const Submission = sequelize.define(
    'Submission',
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
      task_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false
      },
      team_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false
      },
      submitted_by: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false
      },
      status: {
        type: DataTypes.ENUM('draft', 'final'),
        defaultValue: 'draft'
      },
      type: {
        type: DataTypes.ENUM('provisional', 'final'),
        defaultValue: 'provisional'
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      attachment_url: {
        type: DataTypes.STRING(500),
        allowNull: true
      },
      submitted_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      }
    },
    {
      tableName: 'submissions',
      underscored: true,
      timestamps: true
    }
  );

  enableTenantScoping(Submission);

  return Submission;
}

