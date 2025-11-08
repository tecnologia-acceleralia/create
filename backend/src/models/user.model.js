import { DataTypes } from 'sequelize';
import { enableTenantScoping } from '../utils/tenant-scoping.js';

export function UserModel(sequelize) {
  const User = sequelize.define(
    'User',
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
      role_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true
        }
      },
      password: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      first_name: {
        type: DataTypes.STRING(150),
        allowNull: false
      },
      last_name: {
        type: DataTypes.STRING(150),
        allowNull: false
      },
      avatar_url: {
        type: DataTypes.STRING(500),
        allowNull: true
      },
      language: {
        type: DataTypes.STRING(10),
        defaultValue: 'es'
      },
      status: {
        type: DataTypes.ENUM('active', 'inactive', 'invited'),
        defaultValue: 'active'
      }
    },
    {
      tableName: 'users',
      underscored: true,
      timestamps: true,
      defaultScope: {
        attributes: { exclude: ['password'] }
      },
      scopes: {
        withPassword: {
          attributes: { include: ['password'] }
        }
      }
    }
  );

  enableTenantScoping(User);

  User.prototype.toSafeJSON = function toSafeJSON() {
    const { password, ...rest } = this.toJSON();
    return rest;
  };

  return User;
}

