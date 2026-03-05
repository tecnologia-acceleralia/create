import { DataTypes } from 'sequelize';
import { enableTenantScoping } from '../utils/tenant-scoping.js';

export function NotificationModel(sequelize) {
  const Notification = sequelize.define(
    'Notification',
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
      user_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      type: {
        type: DataTypes.ENUM('system', 'evaluation', 'reminder'),
        defaultValue: 'system'
      },
      is_read: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Datos para i18n: title_key, message_key, phase_name por idioma, etc.'
      }
    },
    {
      tableName: 'notifications',
      underscored: true,
      timestamps: true
    }
  );

  enableTenantScoping(Notification);

  return Notification;
}

