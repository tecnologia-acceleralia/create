import { DataTypes } from 'sequelize';

export function TenantModel(sequelize) {
  const Tenant = sequelize.define(
    'Tenant',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true
      },
      slug: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      subdomain: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true
      },
      custom_domain: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      logo_url: {
        type: DataTypes.STRING(500),
        allowNull: true
      },
      primary_color: {
        type: DataTypes.STRING(7),
        allowNull: true
      },
      secondary_color: {
        type: DataTypes.STRING(7),
        allowNull: true
      },
      accent_color: {
        type: DataTypes.STRING(7),
        allowNull: true
      },
      plan_type: {
        type: DataTypes.ENUM('free', 'basic', 'professional', 'enterprise'),
        defaultValue: 'free'
      },
      max_mentors: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true
      },
      max_mentees: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true
      },
      max_appointments_per_month: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true
      },
      status: {
        type: DataTypes.ENUM('active', 'suspended', 'trial', 'cancelled'),
        defaultValue: 'trial'
      }
    },
    {
      tableName: 'tenants',
      underscored: true,
      timestamps: true
    }
  );

  return Tenant;
}

