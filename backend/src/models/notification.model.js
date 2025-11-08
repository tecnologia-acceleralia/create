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

