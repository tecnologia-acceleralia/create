import { DataTypes } from 'sequelize';
import { enableTenantScoping } from '../utils/tenant-scoping.js';

export function UserTenantModel(sequelize) {
  const UserTenant = sequelize.define(
    'UserTenant',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true
      },
      user_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false
      },
      tenant_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false
      },
      status: {
        type: DataTypes.ENUM('active', 'inactive', 'invited'),
        defaultValue: 'active'
      }
    },
    {
      tableName: 'user_tenants',
      underscored: true,
      timestamps: true
    }
  );

  enableTenantScoping(UserTenant);

  return UserTenant;
}

