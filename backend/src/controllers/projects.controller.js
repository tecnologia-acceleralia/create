import { getSequelize } from '../database/database.js';
import { getModels } from '../models/index.js';
import { logger } from '../utils/logger.js';
import { ensureUserNotInOtherTeam, findTeamOr404 } from '../services/team.service.js';

function serializeProjectCard(project, eventMaxTeamSize, currentUserId) {
  const team = project.team;
  const members = team?.members ?? [];
  const activeMembers = members.filter(member => member.status === 'active');
  const isMember = currentUserId ? activeMembers.some(member => member.user_id === currentUserId) : false;
  const hasPending = currentUserId
    ? members.some(member => member.user_id === currentUserId && member.status !== 'active')
    : false;
  const captain = team?.captain ?? null;
  const remainingSlots =
    eventMaxTeamSize !== null ? Math.max(eventMaxTeamSize - activeMembers.length, 0) : null;

  const canJoin =
    !isMember && !hasPending && team?.status === 'open' && (remainingSlots === null || remainingSlots > 0);

  return {
    id: project.id,
    event_id: project.event_id,
    team_id: project.team_id,
    title: project.name,
    summary: project.summary,
    description: team?.description ?? null,
    requirements: team?.requirements ?? null,
    image_url: project.logo_url,
    status: project.status,
    team_status: team?.status ?? null,
    team_name: team?.name ?? null,
    members_count: activeMembers.length,
    remaining_slots: remainingSlots,
    max_team_size: eventMaxTeamSize,
    can_join: Boolean(canJoin),
    is_member: isMember,
    is_captain: team?.captain_id === currentUserId,
    is_pending_member: hasPending,
    captain: captain
      ? {
          id: captain.id,
          email: captain.email,
          first_name: captain.first_name,
          last_name: captain.last_name
        }
      : null,
    members: members.map(member => ({
      id: member.id,
      user_id: member.user_id,
      status: member.status,
      role: member.role,
      user: member.user
        ? {
            id: member.user.id,
            email: member.user.email,
            first_name: member.user.first_name,
            last_name: member.user.last_name
          }
        : null
    }))
  };
}

function getRoleScopes(user) {
  const scopes = user?.roleScopes;
  if (!Array.isArray(scopes)) {
    return [];
  }
  return scopes;
}

function canEditProject(user, team) {
  const roleScopes = getRoleScopes(user);
  if (!roleScopes.length) return false;

  if (roleScopes.includes('tenant_admin') || roleScopes.includes('organizer')) return true;

  if (roleScopes.some(scope => scope === 'team_captain' || scope === 'participant')) {
    return team.captain_id === user.id;
  }

  return false;
}

function canViewProject(user, team) {
  const roleScopes = getRoleScopes(user);
  if (!roleScopes.length) return false;

  if (roleScopes.some(scope => ['tenant_admin', 'organizer', 'evaluator'].includes(scope))) {
    return true;
  }

  if (roleScopes.some(scope => scope === 'team_captain' || scope === 'participant')) {
    if (team.captain_id === user.id) return true;
    return team.members?.some(member => member.user_id === user.id);
  }
  return false;
}

export class ProjectsController {
  static async listByEvent(req, res, next) {
    try {
      const eventId = Number(req.params.eventId);
      const { Event, Project, Team, TeamMember, User } = getModels();

      const event = await Event.findOne({
        where: { id: eventId, tenant_id: req.tenant.id }
      });
      if (!event) {
        return res.status(404).json({ success: false, message: 'Evento no encontrado' });
      }

      const projects = await Project.findAll({
        where: { event_id: eventId },
        include: [
          {
            model: Team,
            as: 'team',
            where: { tenant_id: req.tenant.id },
            required: false,
            attributes: ['id', 'name', 'description', 'requirements', 'status', 'captain_id', 'event_id'],
            include: [
              {
                model: TeamMember,
                as: 'members',
                where: { tenant_id: req.tenant.id },
                required: false,
                include: [
                  {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'email', 'first_name', 'last_name']
                  }
                ]
              },
              {
                model: User,
                as: 'captain',
                attributes: ['id', 'email', 'first_name', 'last_name']
              }
            ]
          }
        ],
        order: [['created_at', 'ASC']]
      });

      const maxTeamSize = event.max_team_size ?? null;

      const currentUserId = req.user?.id ?? null;
      const cards = projects.map(project =>
        serializeProjectCard(project, maxTeamSize, currentUserId)
      );

      res.json({ success: true, data: cards });
    } catch (error) {
      next(error);
    }
  }

  static async createForEvent(req, res, next) {
    const transaction = await getSequelize().transaction();
    try {
      const eventId = Number(req.params.eventId);
      const { Event, Team, TeamMember, Project, User } = getModels();

      const event = await Event.findOne({
        where: { id: eventId, tenant_id: req.tenant.id }
      });
      if (!event) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: 'Evento no encontrado' });
      }

      const captainId =
        req.auth?.isSuperAdmin || (req.user?.roleScopes ?? []).includes('tenant_admin')
          ? Number(req.body.captain_user_id ?? req.user.id)
          : req.user.id;

      const captainUser = await User.findOne({ where: { id: captainId } });
      if (!captainUser) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: 'Capitán no válido' });
      }

      await ensureUserNotInOtherTeam(captainId, eventId);

      const rawTitle = req.body.title ?? req.body.project_title ?? req.body.name;
      const title = typeof rawTitle === 'string' ? rawTitle.trim() : '';
      const rawDescription =
        req.body.description ?? req.body.project_description ?? req.body.summary ?? null;
      const description =
        typeof rawDescription === 'string' && rawDescription.trim().length
          ? rawDescription.trim()
          : null;
      const rawImage =
        req.body.image_url ?? req.body.project_image_url ?? req.body.logo_url ?? null;
      const imageUrl =
        typeof rawImage === 'string' && rawImage.trim().length ? rawImage.trim() : null;
      const rawRequirements = req.body.requirements ?? null;
      const requirements =
        typeof rawRequirements === 'string' && rawRequirements.trim().length
          ? rawRequirements.trim()
          : null;
      const teamName =
        typeof req.body.team_name === 'string' && req.body.team_name.trim().length
          ? req.body.team_name.trim()
          : title;

      if (!title) {
        await transaction.rollback();
        return res
          .status(400)
          .json({ success: false, message: 'El título del proyecto es obligatorio' });
      }

      const team = await Team.create(
        {
          tenant_id: req.tenant.id,
          event_id: eventId,
          name: teamName,
          description,
          requirements,
          status: 'open',
          captain_id: captainId
        },
        { transaction }
      );

      await TeamMember.create(
        {
          tenant_id: req.tenant.id,
          team_id: team.id,
          user_id: captainId,
          role: 'captain',
          status: 'active'
        },
        { transaction }
      );

      const project = await Project.create(
        {
          tenant_id: req.tenant.id,
          team_id: team.id,
          event_id: eventId,
          name: title,
          summary: description,
          logo_url: imageUrl,
          status: 'active'
        },
        { transaction }
      );

      await transaction.commit();

      logger.info('Proyecto creado desde fase 0', {
        projectId: project.id,
        teamId: team.id,
        tenantId: req.tenant.id,
        eventId
      });

      const createdProject = await Project.findOne({
        where: { id: project.id },
        include: [
          {
            model: Team,
            as: 'team',
            include: [
              {
                model: TeamMember,
                as: 'members',
                include: [
                  {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'email', 'first_name', 'last_name']
                  }
                ]
              },
              {
                model: User,
                as: 'captain',
                attributes: ['id', 'email', 'first_name', 'last_name']
              }
            ]
          }
        ]
      });

      const serialized = serializeProjectCard(
        createdProject,
        event.max_team_size ?? null,
        req.user?.id ?? null
      );

      res.status(201).json({ success: true, data: serialized });
    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  }

  static async join(req, res, next) {
    const transaction = await getSequelize().transaction();
    try {
      const projectId = Number(req.params.projectId);
      const { Project, Team, TeamMember, User } = getModels();

      const project = await Project.findOne({ where: { id: projectId } });
      if (!project) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
      }

      const team = await findTeamOr404(project.team_id);
      const eventId = team.event_id;

      if (team.status !== 'open') {
        await transaction.rollback();
        return res.status(409).json({ success: false, message: 'El equipo no admite más miembros' });
      }

      const activeMembers = team.members.filter(member => member.status === 'active');
      const eventMaxSize = team.event?.max_team_size ?? null;

      if (eventMaxSize && activeMembers.length >= eventMaxSize) {
        await transaction.rollback();
        return res.status(409).json({
          success: false,
          message: 'El equipo ha alcanzado el tamaño máximo permitido'
        });
      }

      if (team.members.some(member => member.user_id === req.user.id)) {
        await transaction.rollback();
        return res.status(409).json({
          success: false,
          message: 'Ya perteneces a este equipo'
        });
      }

      await ensureUserNotInOtherTeam(req.user.id, eventId);

      await TeamMember.create(
        {
          team_id: team.id,
          user_id: req.user.id,
          role: 'member',
          status: 'active'
        },
        { transaction }
      );

      await transaction.commit();

      logger.info('Usuario se unió a proyecto', {
        projectId,
        teamId: team.id,
        userId: req.user.id,
        tenantId: req.tenant.id
      });

      const projectWithRelations = await Project.findOne({
        where: { id: projectId },
        include: [
          {
            model: Team,
            as: 'team',
            include: [
              {
                model: TeamMember,
                as: 'members',
                include: [
                  {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'email', 'first_name', 'last_name']
                  }
                ]
              },
              {
                model: User,
                as: 'captain',
                attributes: ['id', 'email', 'first_name', 'last_name']
              }
            ]
          }
        ]
      });

      const serialized = serializeProjectCard(
        projectWithRelations,
        team.event?.max_team_size ?? null,
        req.user.id
      );

      res.status(201).json({ success: true, data: serialized });
    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  }

  static async detail(req, res, next) {
    try {
      const { Project, Team, TeamMember } = getModels();
      const project = await Project.findOne({
        where: { id: req.params.projectId },
        include: [{
          model: Team,
          as: 'team',
          include: [{ model: TeamMember, as: 'members' }]
        }]
      });

      if (!project) {
        return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
      }

      if (!(req.auth?.isSuperAdmin || canViewProject(req.user, project.team))) {
        return res.status(403).json({ success: false, message: 'No autorizado' });
      }

      res.json({ success: true, data: project });
    } catch (error) {
      next(error);
    }
  }

  static async update(req, res, next) {
    try {
      const { Project, Team, TeamMember } = getModels();
      const project = await Project.findOne({
        where: { id: req.params.projectId },
        include: [{
          model: Team,
          as: 'team',
          include: [{ model: TeamMember, as: 'members' }]
        }]
      });

      if (!project) {
        return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
      }

      if (!(req.auth?.isSuperAdmin || canEditProject(req.user, project.team))) {
        return res.status(403).json({ success: false, message: 'No autorizado' });
      }

      await project.update({
        name: req.body.name ?? project.name,
        summary: req.body.summary,
        problem: req.body.problem,
        solution: req.body.solution,
        logo_url: req.body.logo_url,
        repository_url: req.body.repository_url,
        pitch_url: req.body.pitch_url,
        status: req.body.status ?? project.status
      });

      res.json({ success: true, data: project });
    } catch (error) {
      next(error);
    }
  }
}

