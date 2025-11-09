import { DataTypes } from 'sequelize';
import { enableTenantScoping } from '../utils/tenant-scoping.js';

export function PhaseRubricCriterionModel(sequelize) {
  const PhaseRubricCriterion = sequelize.define(
    'PhaseRubricCriterion',
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
      rubric_id: {
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
      weight: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: '1.00'
      },
      max_score: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true
      },
      order_index: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 1
      }
    },
    {
      tableName: 'phase_rubric_criteria',
      underscored: true,
      timestamps: true
    }
  );

  enableTenantScoping(PhaseRubricCriterion);

  return PhaseRubricCriterion;
}

