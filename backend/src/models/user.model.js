import { DataTypes } from 'sequelize';

export function UserModel(sequelize) {
  const User = sequelize.define(
    'User',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true
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
      profile_image_url: {
        type: DataTypes.STRING(500),
        allowNull: true
      },
      grade: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      language: {
        type: DataTypes.STRING(10),
        defaultValue: 'es'
      },
      status: {
        type: DataTypes.ENUM('active', 'inactive', 'invited'),
        defaultValue: 'active'
      },
      last_login_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      is_super_admin: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
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

  User.prototype.toSafeJSON = function toSafeJSON() {
    const { password, ...rest } = this.toJSON();
    return rest;
  };

  return User;
}

