import { DataTypes } from 'sequelize';
import { enableTenantScoping } from '../utils/tenant-scoping.js';

export function RoleModel(sequelize) {
  const Role = sequelize.define(
    'Role',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true
      },
      tenant_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true
      },
      name: {
        type: DataTypes.STRING(150),
        allowNull: false
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      scope: {
        type: DataTypes.ENUM('super_admin', 'tenant_admin', 'organizer', 'evaluator', 'participant', 'team_captain'),
        allowNull: false
      }
    },
    {
      tableName: 'roles',
      underscored: true,
      timestamps: true
    }
  );

  enableTenantScoping(Role);

  Role.addHook('beforeValidate', instance => {
    if (!instance.scope && instance.name) {
      instance.scope = instance.name.toLowerCase();
    }
  });

  return Role;
}

