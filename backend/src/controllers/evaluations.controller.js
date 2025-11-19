import { getSequelize } from '../database/database.js';
import { getModels } from '../models/index.js';
import { generateAiEvaluation } from '../services/evaluation-ai.service.js';
import { isReviewer } from '../utils/authorization.js';
import { findMembership } from '../utils/finders.js';
import { successResponse, notFoundResponse, forbiddenResponse, badRequestResponse, conflictResponse, errorResponse } from '../utils/response.js';

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
        return notFoundResponse(res, 'Entrega no encontrada');
      }

      const evaluation = await Evaluation.create({
        submission_id: submission.id,
        score: req.body.score,
        comment: req.body.comment,
        reviewer_id: req.user.id,
        source: req.body.source ?? 'manual',
        rubric_snapshot: req.body.rubric_snapshot,
        metadata: req.body.metadata
      });

      await notifyTeam(submission.team_id, 'Nueva evaluación', 'Tu entrega ha recibido comentarios.');

      return successResponse(res, evaluation, 201);
    } catch (error) {
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
        return notFoundResponse(res, 'Entrega no encontrada');
      }

      const task = submission.task;
      if (!task) {
        await transaction.rollback();
        return badRequestResponse(res, 'La tarea asociada a la entrega no está disponible');
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
        return conflictResponse(res, 'No hay una rúbrica configurada para esta fase o tarea');
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

      const evaluation = await Evaluation.create(
        {
          submission_id: submission.id,
          reviewer_id: req.user.id,
          score: evaluationResult.overallScore,
          comment: evaluationResult.overallFeedback,
          source: 'ai_assisted',
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

      await notifyTeam(submission.team_id, 'Nueva evaluación asistida por IA', 'Tu entrega ha recibido comentarios generados con IA.');

      return successResponse(res, evaluation, 201);
    } catch (error) {
      await transaction.rollback();
      if (error?.message?.includes?.('OPENAI_API_KEY')) {
        return errorResponse(res, 'Servicio de IA no configurado', 500);
      }
      next(error);
    }
  }

  static async list(req, res, next) {
    try {
      const { Evaluation, Submission } = getModels();
      const submission = await Submission.findOne({ where: { id: req.params.submissionId } });

      if (!submission) {
        return notFoundResponse(res, 'Entrega no encontrada');
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
}

