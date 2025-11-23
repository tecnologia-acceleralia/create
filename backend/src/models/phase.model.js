import { DataTypes } from 'sequelize';
import { enableTenantScoping } from '../utils/tenant-scoping.js';

export function PhaseModel(sequelize) {
  const Phase = sequelize.define(
    'Phase',
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
      name: {
        type: DataTypes.JSON,
        allowNull: false,
        comment: 'Nombre de la fase por idioma: { "es": "...", "ca": "...", "en": "..." }',
        get() {
          const value = this.getDataValue('name');
          return value && typeof value === 'object' ? value : { es: value || '' };
        },
        set(value) {
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
        comment: 'Descripción de la fase por idioma: { "es": "...", "ca": "...", "en": "..." }',
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
      start_date: {
        type: DataTypes.DATE,
        allowNull: true
      },
      end_date: {
        type: DataTypes.DATE,
        allowNull: true
      },
      view_start_date: {
        type: DataTypes.DATE,
        allowNull: true
      },
      view_end_date: {
        type: DataTypes.DATE,
        allowNull: true
      },
      order_index: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 1
      },
      is_elimination: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      }
    },
    {
      tableName: 'phases',
      underscored: true,
      timestamps: true
    }
  );

  enableTenantScoping(Phase);

  return Phase;
}

