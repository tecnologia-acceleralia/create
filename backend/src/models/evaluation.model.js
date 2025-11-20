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
        allowNull: true,
        comment: 'ID de la submission evaluada (nullable para evaluaciones de fase/proyecto)'
      },
      evaluation_scope: {
        type: DataTypes.ENUM('submission', 'phase', 'project'),
        allowNull: false,
        defaultValue: 'submission',
        comment: 'Tipo de evaluación: submission (individual), phase (por fase), project (por proyecto)'
      },
      phase_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        comment: 'ID de la fase evaluada (solo para evaluation_scope = phase)'
      },
      project_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        comment: 'ID del proyecto evaluado (solo para evaluation_scope = project)'
      },
      team_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        comment: 'ID del equipo evaluado (para phase y project)'
      },
      evaluated_submission_ids: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Array de IDs de submissions usadas en la evaluación (para phase y project)'
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
      status: {
        type: DataTypes.ENUM('draft', 'final'),
        defaultValue: 'draft',
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

