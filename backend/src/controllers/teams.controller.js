import { getSequelize } from '../database/database.js';
import { getModels } from '../models/index.js';
import { logger } from '../utils/logger.js';

function isTenantAdmin(user) {
  return user?.role?.scope === 'tenant_admin';
}

async function ensureUserNotInOtherTeam(userId, eventId) {
  const { TeamMember, Team } = getModels();
  const membership = await TeamMember.findOne({
    where: { user_id: userId },
    include: [{ model: Team, as: 'team', where: { event_id: eventId } }]
  });

  if (membership) {
    const error = new Error('El usuario ya pertenece a un equipo en este evento');
    error.statusCode = 409;
    throw error;
  }
}

async function findTeamOr404(teamId) {
  const { Team, TeamMember, User, Project } = getModels();
  const team = await Team.findOne({
    where: { id: teamId },
    include: [
      { model: TeamMember, as: 'members', include: [{ model: User, as: 'user', attributes: ['id', 'email', 'first_name', 'last_name'] }] },
      { model: Project, as: 'project' }
    ]
  });

  if (!team) {
    const error = new Error('Equipo no encontrado');
    error.statusCode = 404;
    throw error;
  }

  return team;
}

function canManageTeam(user, team) {
  return isTenantAdmin(user) || team.captain_id === user.id;
}

export class TeamsController {
  static async listByEvent(req, res, next) {
    try {
      const { Team, TeamMember, User, Project } = getModels();
      const teams = await Team.findAll({
        where: { event_id: req.params.eventId },
        include: [
          { model: TeamMember, as: 'members', include: [{ model: User, as: 'user', attributes: ['id', 'email', 'first_name', 'last_name'] }] },
          { model: Project, as: 'project' }
        ]
      });
      res.json({ success: true, data: teams });
    } catch (error) {
      next(error);
    }
  }

  static async myTeams(req, res, next) {
    try {
      const { TeamMember, Team, Project, Event, User } = getModels();
      const memberships = await TeamMember.findAll({
        where: { user_id: req.user.id },
        include: [
          {
            model: Team,
            as: 'team',
            include: [
              { model: Project, as: 'project' },
              { model: Event, as: 'event' },
              { model: TeamMember, as: 'members', include: [{ model: User, as: 'user', attributes: ['id', 'email', 'first_name', 'last_name'] }] }
            ]
          }
        ]
      });

      res.json({ success: true, data: memberships });
    } catch (error) {
      next(error);
    }
  }

  static async create(req, res, next) {
    const transaction = await getSequelize().transaction();
    try {
      const { Event, Team, TeamMember, Project, User } = getModels();
      const eventId = Number(req.body.event_id);
      const event = await Event.findOne({ where: { id: eventId } });

      if (!event) {
        throw Object.assign(new Error('Evento no encontrado'), { statusCode: 404 });
      }

      const captainId = isTenantAdmin(req.user) && req.body.captain_user_id
        ? Number(req.body.captain_user_id)
        : req.user.id;

      const captainUser = await User.findOne({ where: { id: captainId } });
      if (!captainUser) {
        throw Object.assign(new Error('Capitán no válido'), { statusCode: 404 });
      }

      await ensureUserNotInOtherTeam(captainId, eventId);

      const team = await Team.create({
        event_id: eventId,
        name: req.body.name,
        description: req.body.description,
        requirements: req.body.requirements,
        status: req.body.status ?? 'open',
        captain_id: captainId
      }, { transaction });

      await TeamMember.create({
        team_id: team.id,
        user_id: captainId,
        role: 'captain'
      }, { transaction });

      await Project.create({
        team_id: team.id,
        event_id: eventId,
        name: req.body.project_name ?? req.body.name,
        summary: req.body.project_summary
      }, { transaction });

      await transaction.commit();

      const createdTeam = await findTeamOr404(team.id);
      logger.info('Equipo creado', { teamId: team.id, tenantId: req.tenant.id });
      res.status(201).json({ success: true, data: createdTeam });
    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  }

  static async addMember(req, res, next) {
    const transaction = await getSequelize().transaction();
    try {
      const { TeamMember, User } = getModels();
      const team = await findTeamOr404(req.params.teamId);

      if (!canManageTeam(req.user, team)) {
        return res.status(403).json({ success: false, message: 'No autorizado' });
      }

      let userId = req.body.user_id ? Number(req.body.user_id) : null;

      if (!userId && req.body.user_email) {
        const user = await User.findOne({ where: { email: req.body.user_email } });
        if (!user) {
          await transaction.rollback();
          return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
        }
        userId = user.id;
      }

      if (!userId) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: 'Debes indicar user_id o user_email' });
      }

      await ensureUserNotInOtherTeam(userId, team.event_id);

      const member = await TeamMember.create({
        team_id: team.id,
        user_id: userId,
        role: req.body.role ?? 'member',
        status: 'active'
      }, { transaction });

      await transaction.commit();
      res.status(201).json({ success: true, data: member });
    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  }

  static async removeMember(req, res, next) {
    try {
      const { TeamMember } = getModels();
      const team = await findTeamOr404(req.params.teamId);

      if (!canManageTeam(req.user, team)) {
        return res.status(403).json({ success: false, message: 'No autorizado' });
      }

      const member = await TeamMember.findOne({
        where: { team_id: team.id, user_id: Number(req.params.userId) }
      });

      if (!member) {
        return res.status(404).json({ success: false, message: 'Miembro no encontrado' });
      }

      if (member.user_id === team.captain_id) {
        return res.status(400).json({ success: false, message: 'No puedes eliminar al capitán actual' });
      }

      await member.destroy();
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  static async setCaptain(req, res, next) {
    const transaction = await getSequelize().transaction();
    try {
      const { Team, TeamMember } = getModels();
      const team = await findTeamOr404(req.params.teamId);

      if (!canManageTeam(req.user, team)) {
        return res.status(403).json({ success: false, message: 'No autorizado' });
      }

      const newCaptainId = Number(req.body.user_id);
      const member = await TeamMember.findOne({
        where: { team_id: team.id, user_id: newCaptainId }
      });

      if (!member) {
        return res.status(404).json({ success: false, message: 'El usuario no es miembro del equipo' });
      }

      await member.update({ role: 'captain' }, { transaction });
      await Team.update({ captain_id: newCaptainId }, { where: { id: team.id }, transaction });

      await transaction.commit();
      res.json({ success: true });
    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  }

  static async detail(req, res, next) {
    try {
      const team = await findTeamOr404(req.params.teamId);
      res.json({ success: true, data: team });
    } catch (error) {
      next(error);
    }
  }
}

