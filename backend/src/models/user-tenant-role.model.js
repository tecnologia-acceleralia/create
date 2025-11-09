import { DataTypes } from 'sequelize';
import { enableTenantScoping } from '../utils/tenant-scoping.js';

export function UserTenantRoleModel(sequelize) {
  const UserTenantRole = sequelize.define(
    'UserTenantRole',
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
      user_tenant_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false
      },
      role_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false
      }
    },
    {
      tableName: 'user_tenant_roles',
      underscored: true,
      timestamps: true
    }
  );

  enableTenantScoping(UserTenantRole);

  return UserTenantRole;
}

