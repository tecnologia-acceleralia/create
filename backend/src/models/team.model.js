import { DataTypes } from 'sequelize';
import { enableTenantScoping } from '../utils/tenant-scoping.js';

export function TeamModel(sequelize) {
  const Team = sequelize.define(
    'Team',
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
      captain_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true
      },
      name: {
        type: DataTypes.STRING(200),
        allowNull: false
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      requirements: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      status: {
        type: DataTypes.ENUM('open', 'closed'),
        defaultValue: 'open'
      }
    },
    {
      tableName: 'teams',
      underscored: true,
      timestamps: true
    }
  );

  enableTenantScoping(Team);

  return Team;
}

