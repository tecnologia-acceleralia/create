import { getSequelize } from '../database/database.js';
import { getModels } from '../models/index.js';
import { generateAiEvaluation } from '../services/evaluation-ai.service.js';

function getRoleScopes(user) {
  const scopes = user?.roleScopes;
  if (!Array.isArray(scopes)) {
    return [];
  }
  return scopes;
}

function isReviewer(req) {
  if (req.auth?.isSuperAdmin) {
    return true;
  }
  const roleScopes = getRoleScopes(req.user);
  return roleScopes.some(scope => ['tenant_admin', 'organizer', 'evaluator'].includes(scope));
}

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
        return res.status(403).json({ success: false, message: 'No autorizado' });
      }

      const { Submission, Evaluation } = getModels();
      const submission = await Submission.findOne({ where: { id: req.params.submissionId } });

      if (!submission) {
        return res.status(404).json({ success: false, message: 'Entrega no encontrada' });
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

      res.status(201).json({ success: true, data: evaluation });
    } catch (error) {
      next(error);
    }
  }

  static async createAi(req, res, next) {
    const transaction = await getSequelize().transaction();
    try {
      if (!isReviewer(req)) {
        await transaction.rollback();
        return res.status(403).json({ success: false, message: 'No autorizado' });
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
        return res.status(404).json({ success: false, message: 'Entrega no encontrada' });
      }

      const task = submission.task;
      if (!task) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: 'La tarea asociada a la entrega no está disponible' });
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
        return res.status(409).json({
          success: false,
          message: 'No hay una rúbrica configurada para esta fase o tarea'
        });
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

      res.status(201).json({ success: true, data: evaluation });
    } catch (error) {
      await transaction.rollback();
      if (error?.message?.includes?.('OPENAI_API_KEY')) {
        return res.status(500).json({ success: false, message: 'Servicio de IA no configurado' });
      }
      next(error);
    }
  }

  static async list(req, res, next) {
    try {
      const { Evaluation, Submission } = getModels();
      const submission = await Submission.findOne({ where: { id: req.params.submissionId } });

      if (!submission) {
        return res.status(404).json({ success: false, message: 'Entrega no encontrada' });
      }

      if (!isReviewer(req)) {
        const { TeamMember } = getModels();
        const membership = await TeamMember.findOne({ where: { team_id: submission.team_id, user_id: req.user.id } });
        if (!membership) {
          return res.status(403).json({ success: false, message: 'No autorizado' });
        }
      }

      const evaluations = await Evaluation.findAll({
        where: { submission_id: submission.id },
        order: [['created_at', 'DESC']]
      });

      res.json({ success: true, data: evaluations });
    } catch (error) {
      next(error);
    }
  }
}

