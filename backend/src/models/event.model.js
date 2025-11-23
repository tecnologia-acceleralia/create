import { DataTypes } from 'sequelize';
import { enableTenantScoping } from '../utils/tenant-scoping.js';

export function EventModel(sequelize) {
  const Event = sequelize.define(
    'Event',
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
      created_by: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false
      },
      name: {
        type: DataTypes.JSON,
        allowNull: false,
        comment: 'Nombre del evento por idioma: { "es": "...", "ca": "...", "en": "..." }',
        get() {
          const value = this.getDataValue('name');
          return value && typeof value === 'object' ? value : { es: value || '' };
        },
        set(value) {
          // Si es un string, convertir a objeto con español
          if (typeof value === 'string') {
            this.setDataValue('name', { es: value });
          } else {
            this.setDataValue('name', value);
          }
        }
      },
      description: {
        type: DataTypes.TEXT('long'),
        allowNull: true,
        comment: 'Descripción del evento por idioma: { "es": "...", "ca": "...", "en": "..." }',
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
      description_html: {
        type: DataTypes.TEXT('long'),
        allowNull: true,
        comment: 'Contenido HTML de la descripción por idioma: { "es": "...", "ca": "...", "en": "..." }',
        get() {
          const value = this.getDataValue('description_html');
          if (!value) return null;
          
          // Si es string, intentar parsearlo como JSON primero
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
          if (typeof value === 'object' && value !== null) {
            return value;
          }
          
          // Fallback: convertir a objeto con español
          return { es: value };
        },
        set(value) {
          if (value === null || value === undefined) {
            this.setDataValue('description_html', null);
          } else if (typeof value === 'string') {
            // Si es string, guardarlo como JSON con español
            this.setDataValue('description_html', value ? JSON.stringify({ es: value }) : null);
          } else if (typeof value === 'object') {
            // Si es objeto, serializarlo como JSON string
            this.setDataValue('description_html', JSON.stringify(value));
          } else {
            this.setDataValue('description_html', null);
          }
        }
      },
      start_date: {
        type: DataTypes.DATE,
        allowNull: false
      },
      end_date: {
        type: DataTypes.DATE,
        allowNull: false
      },
      min_team_size: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 1
      },
      max_team_size: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 5
      },
      status: {
        type: DataTypes.ENUM('draft', 'published', 'archived'),
        defaultValue: 'draft'
      },
      video_url: {
        type: DataTypes.STRING(500),
        allowNull: true
      },
      is_public: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      allow_open_registration: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      registration_schema: {
        type: DataTypes.JSON,
        allowNull: true
      },
      publish_start_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      publish_end_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      ai_evaluation_prompt: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Prompt personalizado para la evaluación con IA en texto plano (un solo idioma). El idioma de respuesta se indica al ejecutar el prompt. Si está vacío, se usa el prompt por defecto.'
      },
      ai_evaluation_model: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'Modelo de OpenAI a usar para la evaluación con IA. Si está vacío, se usa el modelo por defecto del sistema.'
      },
      ai_evaluation_temperature: {
        type: DataTypes.DECIMAL(3, 2),
        allowNull: true,
        comment: 'Temperatura para la evaluación con IA (0-2). Si está vacío, se usa 0.2 por defecto.'
      },
      ai_evaluation_max_tokens: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        comment: 'Máximo de tokens en la respuesta de OpenAI. Si está vacío, no se limita.'
      },
      ai_evaluation_top_p: {
        type: DataTypes.DECIMAL(3, 2),
        allowNull: true,
        comment: 'Top-p (nucleus sampling) para la evaluación con IA (0-1). Si está vacío, se usa 1.0 por defecto.'
      },
      ai_evaluation_frequency_penalty: {
        type: DataTypes.DECIMAL(3, 2),
        allowNull: true,
        comment: 'Penalización por frecuencia para la evaluación con IA (-2.0 a 2.0). Si está vacío, se usa 0.0 por defecto.'
      },
      ai_evaluation_presence_penalty: {
        type: DataTypes.DECIMAL(3, 2),
        allowNull: true,
        comment: 'Penalización por presencia para la evaluación con IA (-2.0 a 2.0). Si está vacío, se usa 0.0 por defecto.'
      }
    },
    {
      tableName: 'events',
      underscored: true,
      timestamps: true
    }
  );

  enableTenantScoping(Event);

  return Event;
}


