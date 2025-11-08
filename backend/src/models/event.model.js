import { DataTypes } from 'sequelize';
import { enableTenantScoping } from '../utils/tenant-scoping.js';

export function EventModel(sequelize) {
  const Event = sequelize.define(
    'Event',
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
      created_by: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      start_date: {
        type: DataTypes.DATE,
        allowNull: false
      },
      end_date: {
        type: DataTypes.DATE,
        allowNull: false
      },
      min_team_size: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 1
      },
      max_team_size: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 8
      },
      status: {
        type: DataTypes.ENUM('draft', 'published', 'archived'),
        defaultValue: 'draft'
      }
    },
    {
      tableName: 'events',
      underscored: true,
      timestamps: true
    }
  );

  enableTenantScoping(Event);

  return Event;
}

