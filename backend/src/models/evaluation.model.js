import { DataTypes } from 'sequelize';
import { enableTenantScoping } from '../utils/tenant-scoping.js';

export function EvaluationModel(sequelize) {
  const Evaluation = sequelize.define(
    'Evaluation',
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
      submission_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false
      },
      reviewer_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false
      },
      score: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true
      },
      comment: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      source: {
        type: DataTypes.ENUM('manual', 'ai_assisted'),
        defaultValue: 'manual',
        allowNull: false
      },
      rubric_snapshot: {
        type: DataTypes.JSON,
        allowNull: true
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true
      }
    },
    {
      tableName: 'evaluations',
      underscored: true,
      timestamps: true
    }
  );

  enableTenantScoping(Evaluation);

  return Evaluation;
}

