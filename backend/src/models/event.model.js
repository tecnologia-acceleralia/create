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
      },
      video_url: {
        type: DataTypes.STRING(500),
        allowNull: true
      },
      is_public: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      allow_open_registration: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      publish_start_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      publish_end_at: {
        type: DataTypes.DATE,
        allowNull: true
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

