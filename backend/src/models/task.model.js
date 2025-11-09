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
      },
      phase_rubric_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true
      },
      max_files: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 1
      },
      max_file_size_mb: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true
      },
      allowed_mime_types: {
        type: DataTypes.JSON,
        allowNull: true
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

