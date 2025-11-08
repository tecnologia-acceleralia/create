import { DataTypes } from 'sequelize';
import { enableTenantScoping } from '../utils/tenant-scoping.js';

export function TeamMemberModel(sequelize) {
  const TeamMember = sequelize.define(
    'TeamMember',
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
      team_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false
      },
      user_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false
      },
      role: {
        type: DataTypes.ENUM('captain', 'member', 'mentor'),
        defaultValue: 'member'
      },
      status: {
        type: DataTypes.ENUM('active', 'pending', 'invited'),
        defaultValue: 'active'
      }
    },
    {
      tableName: 'team_members',
      underscored: true,
      timestamps: true,
      indexes: [
        { unique: true, fields: ['team_id', 'user_id'] }
      ]
    }
  );

  enableTenantScoping(TeamMember);

  return TeamMember;
}

