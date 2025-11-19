import { DataTypes } from "sequelize";
import { deleteTenantAssetsBySlug } from "../services/tenant-assets.service.js";
import { logger } from "../utils/logger.js";

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
      hero_content: {
        type: DataTypes.JSON,
        allowNull: true
      },
      start_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: () => new Date().toISOString().slice(0, 10)
      },
      end_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: '2099-12-31'
      },
      tenant_css: {
        type: DataTypes.TEXT('long'),
        allowNull: true
      },
      website_url: {
        type: DataTypes.STRING(500),
        allowNull: true
      },
      facebook_url: {
        type: DataTypes.STRING(500),
        allowNull: true
      },
      instagram_url: {
        type: DataTypes.STRING(500),
        allowNull: true
      },
      linkedin_url: {
        type: DataTypes.STRING(500),
        allowNull: true
      },
      twitter_url: {
        type: DataTypes.STRING(500),
        allowNull: true
      },
      youtube_url: {
        type: DataTypes.STRING(500),
        allowNull: true
      },
      plan_type: {
        type: DataTypes.ENUM('free', 'basic', 'professional', 'enterprise'),
        defaultValue: 'free'
      },
      max_evaluators: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true
      },
      max_participants: {
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
      },
      registration_schema: {
        type: DataTypes.JSON,
        allowNull: true
      }
    },
    {
      tableName: 'tenants',
      underscored: true,
      timestamps: true
    }
  );

  Tenant.addHook('afterDestroy', async tenantInstance => {
    try {
      await deleteTenantAssetsBySlug(tenantInstance.slug);
    } catch (error) {
      logger.warn('No se pudieron eliminar los assets del tenant tras su eliminación', {
        error: error.message,
        tenantId: tenantInstance.id
      });
    }
  });

  return Tenant;
}
