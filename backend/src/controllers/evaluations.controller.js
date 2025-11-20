import { getSequelize } from '../database/database.js';
import { getModels } from '../models/index.js';
import { generateAiEvaluation, generateMultiSubmissionAiEvaluation } from '../services/evaluation-ai.service.js';
import { isReviewer } from '../utils/authorization.js';
import { successResponse, notFoundResponse, forbiddenResponse, badRequestResponse, conflictResponse, errorResponse } from '../utils/response.js';
import { logger } from '../utils/logger.js';
import { t } from '../utils/i18n.js';
import { Op } from 'sequelize';

async function notifyTeam(teamId, title, message) {
  const { TeamMember, Notification } = getModels();
  const members = await TeamMember.findAll({ where: { team_id: teamId } });
  await Promise.all(members.map(member => Notification.create({
    user_id: member.user_id,
    title,
    message,
    type: 'evaluation'
  })));
}

export class EvaluationsController {
  static async create(req, res, next) {
    try {
      if (!isReviewer(req)) {
        return forbiddenResponse(res);
      }

      const { Submission, Evaluation } = getModels();
      const submission = await Submission.findOne({ where: { id: req.params.submissionId } });

      if (!submission) {
        return notFoundResponse(res, t(req, 'evaluations.submissionNotFound'));
      }

      // Obtener tenant_id de la submission para asegurar consistencia
      const tenantId = submission.tenant_id || req.tenant?.id;
      if (!tenantId) {
        logger.error('No se pudo determinar tenant_id para la evaluación', {
          submissionId: submission.id,
          submissionTenantId: submission.tenant_id,
          reqTenant: req.tenant
        });
        return errorResponse(res, t(req, 'evaluations.tenantCannotBeDetermined'), 500);
      }

      const status = req.body.status ?? 'draft';
      
      // Validar que el comentario esté presente y no esté vacío
      if (!req.body.comment || (typeof req.body.comment === 'string' && req.body.comment.trim().length === 0)) {
        return badRequestResponse(res, t(req, 'evaluations.commentRequired'));
      }

      // Validar que el score esté en el rango correcto si se proporciona
      let scoreValue = null;
      if (req.body.score !== undefined && req.body.score !== null && req.body.score !== '') {
        const score = Number(req.body.score);
        if (isNaN(score) || score < 0 || score > 10) {
          return badRequestResponse(res, t(req, 'evaluations.scoreRange10'));
        }
        scoreValue = score;
      }

      const evaluation = await Evaluation.create({
        tenant_id: tenantId,
        submission_id: submission.id,
        score: scoreValue,
        comment: req.body.comment.trim(),
        reviewer_id: req.user.id,
        source: req.body.source ?? 'manual',
        status,
        rubric_snapshot: req.body.rubric_snapshot || null,
        metadata: req.body.metadata || null
      });

      // Solo notificar si es evaluación final
      if (status === 'final') {
        await notifyTeam(submission.team_id, 'Nueva evaluación', 'Tu entrega ha recibido comentarios.');
      }

      return successResponse(res, evaluation, 201);
    } catch (error) {
      logger.error('Error al crear evaluación', {
        error: error.message,
        stack: error.stack,
        submissionId: req.params.submissionId,
        body: req.body
      });
      next(error);
    }
  }

  static async createAi(req, res, next) {
    const transaction = await getSequelize().transaction();
    try {
      if (!isReviewer(req)) {
        await transaction.rollback();
        return forbiddenResponse(res);
      }

      const {
        Submission,
        Evaluation,
        SubmissionFile,
        Task,
        PhaseRubric,
        PhaseRubricCriterion
      } = getModels();

      const submission = await Submission.findOne({
        where: { id: req.params.submissionId },
        include: [
          { model: SubmissionFile, as: 'files' },
          { model: Task, as: 'task' }
        ]
      });

      if (!submission) {
        await transaction.rollback();
        return notFoundResponse(res, t(req, 'evaluations.submissionNotFound'));
      }

      const task = submission.task;
      if (!task) {
        await transaction.rollback();
        return badRequestResponse(res, t(req, 'evaluations.taskNotAvailable'));
      }

      let rubric = null;

      if (task.phase_rubric_id) {
        rubric = await PhaseRubric.findOne({
          where: { id: task.phase_rubric_id },
          include: [{ model: PhaseRubricCriterion, as: 'criteria' }]
        });
      }

      if (!rubric) {
        rubric = await PhaseRubric.findOne({
          where: { phase_id: task.phase_id },
          include: [{ model: PhaseRubricCriterion, as: 'criteria' }],
          order: [['created_at', 'DESC']]
        });
      }

      if (!rubric || !Array.isArray(rubric.criteria) || rubric.criteria.length === 0) {
        await transaction.rollback();
        return conflictResponse(res, t(req, 'evaluations.rubricNotConfigured'));
      }

      const sortedCriteria = [...rubric.criteria].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
      rubric.criteria = sortedCriteria;

      const evaluationResult = await generateAiEvaluation({
        rubric,
        submission: {
          content: submission.content,
          files: submission.files?.map(file => ({
            url: file.url,
            mime_type: file.mime_type,
            size_bytes: file.size_bytes,
            original_name: file.original_name
          })) ?? []
        },
        task,
        locale: req.body.locale ?? 'es-ES'
      });

      // Obtener tenant_id de la submission para asegurar consistencia
      const tenantId = submission.tenant_id || req.tenant?.id;
      if (!tenantId) {
        await transaction.rollback();
        logger.error('No se pudo determinar tenant_id para la evaluación con IA', {
          submissionId: submission.id,
          submissionTenantId: submission.tenant_id,
          reqTenant: req.tenant
        });
        return errorResponse(res, t(req, 'evaluations.tenantCannotBeDetermined'), 500);
      }

      const status = req.body.status ?? 'draft';
      const evaluation = await Evaluation.create(
        {
          tenant_id: tenantId,
          submission_id: submission.id,
          reviewer_id: req.user.id,
          score: evaluationResult.overallScore,
          comment: evaluationResult.overallFeedback,
          source: 'ai_assisted',
          status,
          rubric_snapshot: evaluationResult.rubricSnapshot,
          metadata: {
            criteria: evaluationResult.criteria,
            usage: evaluationResult.usage,
            raw: evaluationResult.raw
          }
        },
        { transaction }
      );

      await transaction.commit();

      // Solo notificar si es evaluación final
      if (status === 'final') {
        await notifyTeam(submission.team_id, 'Nueva evaluación asistida por IA', 'Tu entrega ha recibido comentarios generados con IA.');
      }

      return successResponse(res, evaluation, 201);
    } catch (error) {
      await transaction.rollback();
      logger.error('Error al crear evaluación con IA', {
        error: error.message,
        stack: error.stack,
        submissionId: req.params.submissionId,
        body: req.body
      });
      if (error?.message?.includes?.('OPENAI_API_KEY')) {
        return errorResponse(res, t(req, 'evaluations.aiServiceNotConfigured'), 500);
      }
      next(error);
    }
  }

  static async list(req, res, next) {
    try {
      const { Evaluation, Submission } = getModels();
      const submission = await Submission.findOne({ where: { id: req.params.submissionId } });

      if (!submission) {
        return notFoundResponse(res, t(req, 'evaluations.submissionNotFound'));
      }

      if (!isReviewer(req)) {
        const { TeamMember } = getModels();
        const membership = await TeamMember.findOne({ where: { team_id: submission.team_id, user_id: req.user.id } });
        if (!membership) {
          return forbiddenResponse(res);
        }
      }

      const evaluations = await Evaluation.findAll({
        where: { submission_id: submission.id },
        order: [['created_at', 'DESC']]
      });

      return successResponse(res, evaluations);
    } catch (error) {
      next(error);
    }
  }

  static async update(req, res, next) {
    try {
      if (!isReviewer(req)) {
        return forbiddenResponse(res);
      }

      const { Evaluation, Submission } = getModels();
      const submission = await Submission.findOne({ where: { id: req.params.submissionId } });

      if (!submission) {
        return notFoundResponse(res, t(req, 'evaluations.submissionNotFound'));
      }

      const evaluation = await Evaluation.findOne({
        where: {
          id: req.params.evaluationId,
          submission_id: submission.id
        }
      });

      if (!evaluation) {
        return notFoundResponse(res, t(req, 'evaluations.evaluationNotFound'));
      }

      // Guardar el estado anterior
      const previousStatus = evaluation.status;

      // Validar que el comentario esté presente si se proporciona
      if (req.body.comment !== undefined && (!req.body.comment || (typeof req.body.comment === 'string' && req.body.comment.trim().length === 0))) {
        return badRequestResponse(res, t(req, 'evaluations.commentCannotBeEmpty'));
      }

      // Validar que el score esté en el rango correcto si se proporciona
      let scoreValue = undefined;
      if (req.body.score !== undefined && req.body.score !== null && req.body.score !== '') {
        const score = Number(req.body.score);
        if (isNaN(score) || score < 0 || score > 10) {
          return badRequestResponse(res, t(req, 'evaluations.scoreRange10'));
        }
        scoreValue = score;
      } else if (req.body.score === null || req.body.score === '') {
        scoreValue = null;
      }

      // Actualizar campos permitidos
      const updateData = {};
      if (req.body.score !== undefined) {
        updateData.score = scoreValue;
      }
      if (req.body.comment !== undefined) {
        updateData.comment = req.body.comment ? req.body.comment.trim() : null;
      }
      if (req.body.status !== undefined) {
        updateData.status = req.body.status;
      }
      if (req.body.rubric_snapshot !== undefined) {
        updateData.rubric_snapshot = req.body.rubric_snapshot || null;
      }
      if (req.body.metadata !== undefined) {
        updateData.metadata = req.body.metadata || null;
      }

      await evaluation.update(updateData);

      // Si se cambió a final y antes no lo era, notificar
      if (updateData.status === 'final' && previousStatus !== 'final') {
        await notifyTeam(submission.team_id, 'Nueva evaluación', 'Tu entrega ha recibido comentarios.');
      }

      return successResponse(res, evaluation);
    } catch (error) {
      next(error);
    }
  }

  static async getFinal(req, res, next) {
    try {
      const { Evaluation, Submission } = getModels();
      const submission = await Submission.findOne({ where: { id: req.params.submissionId } });

      if (!submission) {
        return notFoundResponse(res, t(req, 'evaluations.submissionNotFound'));
      }

      if (!isReviewer(req)) {
        const { TeamMember } = getModels();
        const membership = await TeamMember.findOne({ where: { team_id: submission.team_id, user_id: req.user.id } });
        if (!membership) {
          return forbiddenResponse(res);
        }
      }

      const evaluation = await Evaluation.findOne({
        where: {
          submission_id: submission.id,
          status: 'final'
        },
        order: [['created_at', 'DESC']]
      });

      if (!evaluation) {
        return notFoundResponse(res, t(req, 'evaluations.noFinalEvaluation'));
      }

      return successResponse(res, evaluation);
    } catch (error) {
      next(error);
    }
  }

  // Evaluación de fase
  static async createPhaseEvaluation(req, res, next) {
    try {
      if (!isReviewer(req)) {
        return forbiddenResponse(res);
      }

      const { Phase, Evaluation, Submission, Task, Team } = getModels();
      const phaseId = Number(req.params.phaseId);
      const teamId = Number(req.params.teamId);

      const phase = await Phase.findOne({ where: { id: phaseId } });
      if (!phase) {
        return notFoundResponse(res, t(req, 'evaluations.phaseNotFound'));
      }

      const team = await Team.findOne({ where: { id: teamId } });
      if (!team) {
        return notFoundResponse(res, t(req, 'evaluations.teamNotFound'));
      }

      // Validar que el equipo pertenece al mismo evento que la fase
      if (team.event_id !== phase.event_id) {
        return badRequestResponse(res, t(req, 'evaluations.teamNotInSameEvent'));
      }

      // Validar submission_ids proporcionados
      const submissionIds = Array.isArray(req.body.submission_ids) ? req.body.submission_ids : [];
      if (submissionIds.length === 0) {
        return badRequestResponse(res, t(req, 'evaluations.atLeastOneSubmissionRequired'));
      }

      // Verificar que las submissions pertenecen al equipo y a tareas de la fase
      const tasks = await Task.findAll({ where: { phase_id: phaseId } });
      const taskIds = tasks.map(t => t.id);
      
      const submissions = await Submission.findAll({
        where: {
          id: { [Op.in]: submissionIds },
          team_id: teamId,
          task_id: { [Op.in]: taskIds }
        }
      });

      if (submissions.length !== submissionIds.length) {
        return badRequestResponse(res, t(req, 'evaluations.submissionsNotBelongToTeamOrPhase'));
      }

      const status = req.body.status ?? 'draft';
      
      // Validar que el comentario esté presente y no esté vacío
      if (!req.body.comment || (typeof req.body.comment === 'string' && req.body.comment.trim().length === 0)) {
        return badRequestResponse(res, t(req, 'evaluations.commentRequired'));
      }

      // Validar que el score esté en el rango correcto si se proporciona
      let scoreValue = null;
      if (req.body.score !== undefined && req.body.score !== null && req.body.score !== '') {
        const score = Number(req.body.score);
        if (isNaN(score) || score < 0 || score > 100) {
          return badRequestResponse(res, t(req, 'evaluations.scoreRange100'));
        }
        scoreValue = score;
      }

      const tenantId = phase.tenant_id || req.tenant?.id;
      if (!tenantId) {
        return errorResponse(res, t(req, 'evaluations.tenantCannotBeDetermined'), 500);
      }

      const evaluation = await Evaluation.create({
        tenant_id: tenantId,
        evaluation_scope: 'phase',
        phase_id: phaseId,
        team_id: teamId,
        submission_id: null, // Nullable para evaluaciones de fase (migración 0009)
        evaluated_submission_ids: submissionIds,
        score: scoreValue,
        comment: req.body.comment.trim(),
        reviewer_id: req.user.id,
        source: req.body.source ?? 'manual',
        status,
        rubric_snapshot: req.body.rubric_snapshot || null,
        metadata: req.body.metadata || null
      });

      // Solo notificar si es evaluación final
      if (status === 'final') {
        await notifyTeam(teamId, 'Nueva evaluación de fase', `La fase "${phase.name}" ha recibido una evaluación.`);
      }

      return successResponse(res, evaluation, 201);
    } catch (error) {
      logger.error('Error al crear evaluación de fase', {
        error: error.message,
        stack: error.stack,
        phaseId: req.params.phaseId,
        teamId: req.params.teamId,
        body: req.body
      });
      next(error);
    }
  }

  // Evaluación con IA de fase
  static async createPhaseAiEvaluation(req, res, next) {
    const transaction = await getSequelize().transaction();
    try {
      if (!isReviewer(req)) {
        await transaction.rollback();
        return forbiddenResponse(res);
      }

      const {
        Phase,
        Evaluation,
        Submission,
        SubmissionFile,
        Task,
        Team,
        PhaseRubric,
        PhaseRubricCriterion
      } = getModels();

      const phaseId = Number(req.params.phaseId);
      const teamId = Number(req.params.teamId);

      const phase = await Phase.findOne({ where: { id: phaseId } });
      if (!phase) {
        await transaction.rollback();
        return notFoundResponse(res, t(req, 'evaluations.phaseNotFound'));
      }

      const team = await Team.findOne({ where: { id: teamId } });
      if (!team) {
        await transaction.rollback();
        return notFoundResponse(res, t(req, 'evaluations.teamNotFound'));
      }

      // Validar submission_ids proporcionados
      const submissionIds = Array.isArray(req.body.submission_ids) ? req.body.submission_ids : [];
      if (submissionIds.length === 0) {
        await transaction.rollback();
        return badRequestResponse(res, t(req, 'evaluations.atLeastOneSubmissionRequired'));
      }

      // Obtener tareas de la fase
      const tasks = await Task.findAll({ where: { phase_id: phaseId } });
      const taskIds = tasks.map(t => t.id);

      // Obtener submissions con sus archivos
      const submissions = await Submission.findAll({
        where: {
          id: { [Op.in]: submissionIds },
          team_id: teamId,
          task_id: { [Op.in]: taskIds }
        },
        include: [
          { model: SubmissionFile, as: 'files' }
        ],
        order: [['submitted_at', 'ASC']]
      });

      if (submissions.length !== submissionIds.length) {
        await transaction.rollback();
        return badRequestResponse(res, t(req, 'evaluations.submissionsNotBelongToTeamOrPhase'));
      }

      // Buscar rúbrica de la fase
      let rubric = await PhaseRubric.findOne({
        where: {
          phase_id: phaseId,
          rubric_scope: 'phase'
        },
        include: [{ model: PhaseRubricCriterion, as: 'criteria' }],
        order: [['created_at', 'DESC']]
      });

      if (!rubric || !Array.isArray(rubric.criteria) || rubric.criteria.length === 0) {
        await transaction.rollback();
        return conflictResponse(res, t(req, 'evaluations.rubricNotConfiguredForPhase'));
      }

      const sortedCriteria = [...rubric.criteria].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
      rubric.criteria = sortedCriteria;

      // Preparar datos de submissions para la evaluación
      const submissionsData = submissions.map(submission => ({
        content: submission.content,
        files: submission.files?.map(file => ({
          url: file.url,
          mime_type: file.mime_type,
          size_bytes: file.size_bytes,
          original_name: file.original_name
        })) ?? [],
        task_id: submission.task_id,
        submitted_at: submission.submitted_at
      }));

      const evaluationResult = await generateMultiSubmissionAiEvaluation({
        rubric,
        submissions: submissionsData,
        tasks: tasks.map(t => ({ id: t.id, title: t.title, description: t.description })),
        locale: req.body.locale ?? 'es-ES'
      });

      const tenantId = phase.tenant_id || req.tenant?.id;
      if (!tenantId) {
        await transaction.rollback();
        return errorResponse(res, t(req, 'evaluations.tenantCannotBeDetermined'), 500);
      }

      const status = req.body.status ?? 'draft';
      const evaluation = await Evaluation.create(
        {
          tenant_id: tenantId,
          evaluation_scope: 'phase',
          phase_id: phaseId,
          team_id: teamId,
          submission_id: null, // Nullable para evaluaciones de fase (migración 0009)
          evaluated_submission_ids: submissionIds,
          reviewer_id: req.user.id,
          score: evaluationResult.overallScore,
          comment: evaluationResult.overallFeedback,
          source: 'ai_assisted',
          status,
          rubric_snapshot: evaluationResult.rubricSnapshot,
          metadata: {
            criteria: evaluationResult.criteria,
            usage: evaluationResult.usage,
            raw: evaluationResult.raw
          }
        },
        { transaction }
      );

      await transaction.commit();

      // Solo notificar si es evaluación final
      if (status === 'final') {
        await notifyTeam(teamId, 'Nueva evaluación de fase asistida por IA', `La fase "${phase.name}" ha recibido una evaluación generada con IA.`);
      }

      return successResponse(res, evaluation, 201);
    } catch (error) {
      await transaction.rollback();
      logger.error('Error al crear evaluación de fase con IA', {
        error: error.message,
        stack: error.stack,
        phaseId: req.params.phaseId,
        teamId: req.params.teamId,
        body: req.body
      });
      if (error?.message?.includes?.('OPENAI_API_KEY')) {
        return errorResponse(res, t(req, 'evaluations.aiServiceNotConfigured'), 500);
      }
      next(error);
    }
  }

  // Obtener evaluaciones de una fase
  static async getPhaseEvaluations(req, res, next) {
    try {
      const { Phase, Evaluation, Team } = getModels();
      const phaseId = Number(req.params.phaseId);
      const teamId = Number(req.params.teamId);

      const phase = await Phase.findOne({ where: { id: phaseId } });
      if (!phase) {
        return notFoundResponse(res, t(req, 'evaluations.phaseNotFound'));
      }

      const team = await Team.findOne({ where: { id: teamId } });
      if (!team) {
        return notFoundResponse(res, t(req, 'evaluations.teamNotFound'));
      }

      // Verificar permisos: solo revisores o miembros del equipo
      if (!isReviewer(req)) {
        const { TeamMember } = getModels();
        const membership = await TeamMember.findOne({ where: { team_id: teamId, user_id: req.user.id } });
        if (!membership) {
          return forbiddenResponse(res);
        }
      }

      const evaluations = await Evaluation.findAll({
        where: {
          phase_id: phaseId,
          team_id: teamId,
          evaluation_scope: 'phase'
        },
        order: [['created_at', 'DESC']]
      });

      return successResponse(res, evaluations);
    } catch (error) {
      next(error);
    }
  }

  // Evaluación de proyecto
  static async createProjectEvaluation(req, res, next) {
    try {
      if (!isReviewer(req)) {
        return forbiddenResponse(res);
      }

      const { Project, Evaluation, Phase, Task, Team } = getModels();
      const projectId = Number(req.params.projectId);

      const project = await Project.findOne({ where: { id: projectId } });
      if (!project) {
        return notFoundResponse(res, t(req, 'evaluations.projectNotFound'));
      }

      const team = await Team.findOne({ where: { id: project.team_id } });
      if (!team) {
        return notFoundResponse(res, t(req, 'evaluations.teamNotFound'));
      }

      // Validar que todas las fases con tareas obligatorias estén evaluadas
      const phases = await Phase.findAll({
        where: { event_id: project.event_id },
        include: [{
          model: Task,
          as: 'tasks',
          where: { is_required: true },
          required: false
        }]
      });

      const requiredPhases = phases.filter(p => p.tasks && p.tasks.length > 0);
      
      for (const phase of requiredPhases) {
        const phaseEvaluation = await Evaluation.findOne({
          where: {
            phase_id: phase.id,
            team_id: team.id,
            evaluation_scope: 'phase',
            status: 'final'
          }
        });

        if (!phaseEvaluation) {
          return badRequestResponse(res, t(req, 'evaluations.mustEvaluatePhaseFirst', { phaseName: phase.name }));
        }
      }

      // Validar submission_ids proporcionados (opcional para proyecto, pueden venir de fases anteriores)
      const submissionIds = Array.isArray(req.body.submission_ids) ? req.body.submission_ids : [];
      
      // Si se proporcionan submission_ids, validarlos
      if (submissionIds.length > 0) {
        const tasks = await Task.findAll({ where: { event_id: project.event_id } });
        const taskIds = tasks.map(t => t.id);
        
        const { Submission } = getModels();
        const submissions = await Submission.findAll({
          where: {
            id: { [Op.in]: submissionIds },
            team_id: team.id,
            task_id: { [Op.in]: taskIds }
          }
        });

        if (submissions.length !== submissionIds.length) {
          return badRequestResponse(res, t(req, 'evaluations.submissionsNotBelongToTeamOrEvent'));
        }
      }

      const status = req.body.status ?? 'draft';
      
      // Validar que el comentario esté presente y no esté vacío
      if (!req.body.comment || (typeof req.body.comment === 'string' && req.body.comment.trim().length === 0)) {
        return badRequestResponse(res, t(req, 'evaluations.commentRequired'));
      }

      // Validar que el score esté en el rango correcto si se proporciona
      let scoreValue = null;
      if (req.body.score !== undefined && req.body.score !== null && req.body.score !== '') {
        const score = Number(req.body.score);
        if (isNaN(score) || score < 0 || score > 10) {
          return badRequestResponse(res, t(req, 'evaluations.scoreRange10'));
        }
        scoreValue = score;
      }

      const tenantId = project.tenant_id || req.tenant?.id;
      if (!tenantId) {
        return errorResponse(res, t(req, 'evaluations.tenantCannotBeDetermined'), 500);
      }

      const evaluation = await Evaluation.create({
        tenant_id: tenantId,
        evaluation_scope: 'project',
        project_id: projectId,
        team_id: team.id,
        submission_id: null, // Nullable para evaluaciones de proyecto (migración 0009)
        evaluated_submission_ids: submissionIds.length > 0 ? submissionIds : null,
        score: scoreValue,
        comment: req.body.comment.trim(),
        reviewer_id: req.user.id,
        source: req.body.source ?? 'manual',
        status,
        rubric_snapshot: req.body.rubric_snapshot || null,
        metadata: req.body.metadata || null
      });

      // Solo notificar si es evaluación final
      if (status === 'final') {
        await notifyTeam(team.id, 'Nueva evaluación de proyecto', 'Tu proyecto ha recibido una evaluación completa.');
      }

      return successResponse(res, evaluation, 201);
    } catch (error) {
      logger.error('Error al crear evaluación de proyecto', {
        error: error.message,
        stack: error.stack,
        projectId: req.params.projectId,
        body: req.body
      });
      next(error);
    }
  }

  // Obtener evaluaciones de un proyecto
  static async getProjectEvaluations(req, res, next) {
    try {
      const { Project, Evaluation, Team } = getModels();
      const projectId = Number(req.params.projectId);

      const project = await Project.findOne({ where: { id: projectId } });
      if (!project) {
        return notFoundResponse(res, t(req, 'evaluations.projectNotFound'));
      }

      const team = await Team.findOne({ where: { id: project.team_id } });
      if (!team) {
        return notFoundResponse(res, t(req, 'evaluations.teamNotFound'));
      }

      // Verificar permisos: solo revisores o miembros del equipo
      if (!isReviewer(req)) {
        const { TeamMember } = getModels();
        const membership = await TeamMember.findOne({ where: { team_id: team.id, user_id: req.user.id } });
        if (!membership) {
          return forbiddenResponse(res);
        }
      }

      const evaluations = await Evaluation.findAll({
        where: {
          project_id: projectId,
          evaluation_scope: 'project'
        },
        order: [['created_at', 'DESC']]
      });

      return successResponse(res, evaluations);
    } catch (error) {
      next(error);
    }
  }
}

