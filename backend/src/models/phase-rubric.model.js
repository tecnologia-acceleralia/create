import { DataTypes } from 'sequelize';
import { enableTenantScoping } from '../utils/tenant-scoping.js';

export function PhaseRubricModel(sequelize) {
  const PhaseRubric = sequelize.define(
    'PhaseRubric',
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
        allowNull: true
      },
      rubric_scope: {
        type: DataTypes.ENUM('phase', 'project'),
        allowNull: false,
        defaultValue: 'phase'
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      scale_min: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      scale_max: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 100
      },
      model_preference: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      created_by: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true
      },
      updated_by: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true
      }
    },
    {
      tableName: 'phase_rubrics',
      underscored: true,
      timestamps: true
    }
  );

  enableTenantScoping(PhaseRubric);

  return PhaseRubric;
}

