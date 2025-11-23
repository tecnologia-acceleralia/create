export async function up(queryInterface, Sequelize) {
  // Verificar qué columnas ya existen antes de agregarlas
  const tableDescription = await queryInterface.describeTable('evaluations');

  // Agregar campo evaluation_scope para identificar el tipo de evaluación
  if (!tableDescription.evaluation_scope) {
    await queryInterface.addColumn('evaluations', 'evaluation_scope', {
      type: Sequelize.ENUM('submission', 'phase', 'project'),
      allowNull: false,
      defaultValue: 'submission',
      comment: 'Tipo de evaluación: submission (individual), phase (por fase), project (por proyecto)'
    });
  }

  // Agregar campo phase_id para evaluaciones de fase
  if (!tableDescription.phase_id) {
    await queryInterface.addColumn('evaluations', 'phase_id', {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: 'phases',
        key: 'id'
      },
      onDelete: 'CASCADE',
      comment: 'ID de la fase evaluada (solo para evaluation_scope = phase)'
    });
  }

  // Agregar campo project_id para evaluaciones de proyecto
  if (!tableDescription.project_id) {
    await queryInterface.addColumn('evaluations', 'project_id', {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: 'projects',
        key: 'id'
      },
      onDelete: 'CASCADE',
      comment: 'ID del proyecto evaluado (solo para evaluation_scope = project)'
    });
  }

  // Agregar campo evaluated_submission_ids para registrar qué submissions se usaron
  if (!tableDescription.evaluated_submission_ids) {
    await queryInterface.addColumn('evaluations', 'evaluated_submission_ids', {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'Array de IDs de submissions usadas en la evaluación (para phase y project)'
    });
  }

  // Agregar campo team_id para facilitar consultas
  if (!tableDescription.team_id) {
    await queryInterface.addColumn('evaluations', 'team_id', {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: 'teams',
        key: 'id'
      },
      onDelete: 'CASCADE',
      comment: 'ID del equipo evaluado (para phase y project)'
    });
  }

  // Nota: submission_id se hace nullable en la migración 0010-fix-submission-id-nullable.js
  // porque requiere eliminar y recrear la foreign key constraint
}

export async function down(queryInterface, Sequelize) {
  // Verificar qué columnas existen antes de removerlas
  const tableDescription = await queryInterface.describeTable('evaluations');

  // Remover campos agregados solo si existen
  if (tableDescription.team_id) {
    await queryInterface.removeColumn('evaluations', 'team_id');
  }
  if (tableDescription.evaluated_submission_ids) {
    await queryInterface.removeColumn('evaluations', 'evaluated_submission_ids');
  }
  if (tableDescription.project_id) {
    await queryInterface.removeColumn('evaluations', 'project_id');
  }
  if (tableDescription.phase_id) {
    await queryInterface.removeColumn('evaluations', 'phase_id');
  }
  if (tableDescription.evaluation_scope) {
    await queryInterface.removeColumn('evaluations', 'evaluation_scope');
  }

  // Nota: submission_id se revierte en la migración 0010-fix-submission-id-nullable.js
}

