import { DataTypes } from 'sequelize';
import { enableTenantScoping } from '../utils/tenant-scoping.js';

export function TaskModel(sequelize) {
  const Task = sequelize.define(
    'Task',
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
      phase_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      delivery_type: {
        type: DataTypes.ENUM('text', 'file', 'url', 'video', 'audio', 'zip'),
        defaultValue: 'file'
      },
      is_required: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      due_date: {
        type: DataTypes.DATE,
        allowNull: true
      },
      status: {
        type: DataTypes.ENUM('draft', 'active', 'closed'),
        defaultValue: 'draft'
      }
    },
    {
      tableName: 'tasks',
      underscored: true,
      timestamps: true
    }
  );

  enableTenantScoping(Task);

  return Task;
}

