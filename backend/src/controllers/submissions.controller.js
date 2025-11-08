import { getSequelize } from '../database/database.js';
import { getModels } from '../models/index.js';

function isManager(user) {
  const role = user?.role?.scope;
  return ['tenant_admin', 'organizer'].includes(role ?? '');
}

function isReviewer(user) {
  const role = user?.role?.scope;
  return ['tenant_admin', 'organizer', 'mentor'].includes(role ?? '');
}

async function findMembership(userId, eventId) {
  const { TeamMember, Team } = getModels();
  return TeamMember.findOne({
    where: { user_id: userId },
    include: [{ model: Team, as: 'team', where: { event_id: eventId } }]
  });
}

export class SubmissionsController {
  static async create(req, res, next) {
    const transaction = await getSequelize().transaction();
    try {
      const { Task, Submission, TeamMember } = getModels();
      const taskId = Number(req.params.taskId ?? req.body.task_id);
      const task = await Task.findOne({ where: { id: taskId } });
      if (!task) {
        throw Object.assign(new Error('Tarea no encontrada'), { statusCode: 404 });
      }

      let teamId = req.body.team_id ? Number(req.body.team_id) : null;

      if (isManager(req.user) && !teamId) {
        throw Object.assign(new Error('team_id requerido para administradores'), { statusCode: 400 });
      }

      if (!isManager(req.user)) {
        const membership = await findMembership(req.user.id, task.event_id);
        if (!membership) {
          throw Object.assign(new Error('No perteneces a un equipo en este evento'), { statusCode: 403 });
        }
        teamId = membership.team.id;
      }

      const submission = await Submission.create({
        task_id: task.id,
        event_id: task.event_id,
        team_id: teamId,
        submitted_by: req.user.id,
        status: req.body.status ?? 'draft',
        type: req.body.type ?? 'provisional',
        content: req.body.content,
        attachment_url: req.body.attachment_url
      }, { transaction });

      // Ensure membership exists for submitter in team
      const membership = await TeamMember.findOne({ where: { team_id: teamId, user_id: req.user.id } });
      if (!membership && !isManager(req.user)) {
        throw Object.assign(new Error('No autorizado para registrar entregas de este equipo'), { statusCode: 403 });
      }

      await transaction.commit();
      const result = await Submission.findOne({
        where: { id: submission.id },
        include: ['task', 'team']
      });
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  }

  static async listByTask(req, res, next) {
    try {
      const { Submission, Team, User, Task } = getModels();
      const taskId = Number(req.params.taskId);

      const task = await Task.findOne({ where: { id: taskId } });
      if (!task) {
        return res.status(404).json({ success: false, message: 'Tarea no encontrada' });
      }

      let whereClause = { task_id: taskId };

      if (!isReviewer(req.user)) {
        const membership = await findMembership(req.user.id, task.event_id);
        if (!membership) {
          return res.status(403).json({ success: false, message: 'No autorizado' });
        }
        whereClause = { ...whereClause, team_id: membership.team.id };
      }

      const submissions = await Submission.findAll({
        where: whereClause,
        order: [['submitted_at', 'DESC']],
        include: [
          { model: Team, as: 'team' },
          { model: User, as: 'submitter', attributes: ['id', 'email', 'first_name', 'last_name'] }
        ]
      });

      res.json({ success: true, data: submissions });
    } catch (error) {
      next(error);
    }
  }

  static async detail(req, res, next) {
    try {
      const { Submission, Evaluation } = getModels();
      const submission = await Submission.findOne({
        where: { id: req.params.submissionId },
        include: [{ model: Evaluation, as: 'evaluations' }]
      });

      if (!submission) {
        return res.status(404).json({ success: false, message: 'Entrega no encontrada' });
      }

      if (!isReviewer(req.user)) {
        const membership = await findMembership(req.user.id, submission.event_id);
        if (!membership || membership.team.id !== submission.team_id) {
          return res.status(403).json({ success: false, message: 'No autorizado' });
        }
      }

      res.json({ success: true, data: submission });
    } catch (error) {
      next(error);
    }
  }
}

