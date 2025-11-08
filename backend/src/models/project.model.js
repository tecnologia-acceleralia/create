import { DataTypes } from 'sequelize';
import { enableTenantScoping } from '../utils/tenant-scoping.js';

export function ProjectModel(sequelize) {
  const Project = sequelize.define(
    'Project',
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
      team_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      summary: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      problem: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      solution: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      status: {
        type: DataTypes.ENUM('draft', 'active', 'completed'),
        defaultValue: 'draft'
      },
      logo_url: {
        type: DataTypes.STRING(500),
        allowNull: true
      },
      repository_url: {
        type: DataTypes.STRING(500),
        allowNull: true
      },
      pitch_url: {
        type: DataTypes.STRING(500),
        allowNull: true
      }
    },
    {
      tableName: 'projects',
      underscored: true,
      timestamps: true
    }
  );

  enableTenantScoping(Project);

  return Project;
}

