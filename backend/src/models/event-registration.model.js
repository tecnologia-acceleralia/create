import { DataTypes } from 'sequelize';
import { enableTenantScoping } from '../utils/tenant-scoping.js';

export function EventRegistrationModel(sequelize) {
  const EventRegistration = sequelize.define(
    'EventRegistration',
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
      event_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false
      },
      user_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false
      },
      grade: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      answers: {
        type: DataTypes.JSON,
        allowNull: true
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'registered'
      }
    },
    {
      tableName: 'event_registrations',
      underscored: true,
      timestamps: true,
      indexes: [
        { fields: ['event_id', 'user_id'], unique: true },
        { fields: ['tenant_id', 'event_id'] },
        { fields: ['tenant_id', 'grade'] }
      ]
    }
  );

  enableTenantScoping(EventRegistration);

  return EventRegistration;
}
