import { getModels } from '../models/index.js';

function isReviewer(user) {
  const role = user?.role?.scope;
  return ['tenant_admin', 'organizer', 'mentor'].includes(role ?? '');
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
      if (!isReviewer(req.user)) {
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
        reviewer_id: req.user.id
      });

      await notifyTeam(submission.team_id, 'Nueva evaluación', 'Tu entrega ha recibido comentarios.');

      res.status(201).json({ success: true, data: evaluation });
    } catch (error) {
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

      if (!isReviewer(req.user)) {
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

