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
        type: DataTypes.JSON,
        allowNull: false,
        comment: 'Título de la tarea por idioma: { "es": "...", "ca": "...", "en": "..." }',
        get() {
          const value = this.getDataValue('title');
          return value && typeof value === 'object' ? value : { es: value || '' };
        },
        set(value) {
          if (typeof value === 'string') {
            this.setDataValue('title', { es: value });
          } else {
            this.setDataValue('title', value);
          }
        }
      },
      description: {
        type: DataTypes.TEXT('long'),
        allowNull: true,
        comment: 'Descripción de la tarea por idioma: { "es": "...", "ca": "...", "en": "..." }',
        get() {
          const value = this.getDataValue('description');
          if (!value) return null;
          // Si es string, intentar parsearlo como JSON
          if (typeof value === 'string') {
            try {
              const parsed = JSON.parse(value);
              if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
                return parsed;
              }
            } catch (e) {
              // Si no es JSON válido, tratarlo como string simple
              return { es: value };
            }
          }
          // Si ya es un objeto, devolverlo directamente
          return typeof value === 'object' ? value : { es: value };
        },
        set(value) {
          if (value === null || value === undefined) {
            this.setDataValue('description', null);
          } else if (typeof value === 'string') {
            // Si es string, guardarlo como JSON con español
            this.setDataValue('description', value ? JSON.stringify({ es: value }) : null);
          } else if (typeof value === 'object') {
            // Si es objeto, serializarlo como JSON string
            this.setDataValue('description', JSON.stringify(value));
          } else {
            this.setDataValue('description', null);
          }
        }
      },
      intro_html: {
        type: DataTypes.TEXT('long'),
        allowNull: true,
        comment: 'Contenido HTML de introducción por idioma: { "es": "...", "ca": "...", "en": "..." }',
        get() {
          const value = this.getDataValue('intro_html');
          if (!value) return null;
          // Si es string, intentar parsearlo como JSON
          if (typeof value === 'string') {
            try {
              const parsed = JSON.parse(value);
              if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
                return parsed;
              }
            } catch (e) {
              // Si no es JSON válido, tratarlo como string simple
              return { es: value };
            }
          }
          // Si ya es un objeto, devolverlo directamente
          return typeof value === 'object' ? value : { es: value };
        },
        set(value) {
          if (value === null || value === undefined) {
            this.setDataValue('intro_html', null);
          } else if (typeof value === 'string') {
            // Si es string, guardarlo como JSON con español
            this.setDataValue('intro_html', value ? JSON.stringify({ es: value }) : null);
          } else if (typeof value === 'object') {
            // Si es objeto, serializarlo como JSON string
            this.setDataValue('intro_html', JSON.stringify(value));
          } else {
            this.setDataValue('intro_html', null);
          }
        }
      },
      delivery_type: {
        type: DataTypes.ENUM('text', 'file', 'url', 'video', 'audio', 'zip', 'none'),
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
      order_index: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 1
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

