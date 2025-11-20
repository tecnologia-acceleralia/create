import { getSequelize } from '../database/database.js';
import { getModels } from '../models/index.js';
import { logger } from '../utils/logger.js';
import { ensureUserNotInOtherTeam, findTeamOr404 } from '../services/team.service.js';
import { getRoleScopes, canEditProject, canViewProject } from '../utils/authorization.js';
import { successResponse, notFoundResponse, forbiddenResponse, badRequestResponse, conflictResponse } from '../utils/response.js';
import { decodeBase64Image, uploadProjectLogo, deleteObjectByUrl } from '../services/tenant-assets.service.js';
import { ensureParticipantRole } from '../utils/role-management.js';
import { Op } from 'sequelize';

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
    project.status === 'active' &&
    !isMember &&
    !hasPending &&
    team?.status === 'open' &&
    (remainingSlots === null || remainingSlots > 0);

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

export class ProjectsController {
  static async listByEvent(req, res, next) {
    try {
      const eventId = Number(req.params.eventId);
      const { Event, Project, Team, TeamMember, User } = getModels();

      const event = await Event.findOne({
        where: { id: eventId, tenant_id: req.tenant.id }
      });
      if (!event) {
        return notFoundResponse(res, 'Evento no encontrado');
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

      return successResponse(res, cards);
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
        return notFoundResponse(res, 'Evento no encontrado');
      }

      const captainId =
        req.auth?.isSuperAdmin || (req.user?.roleScopes ?? []).includes('tenant_admin')
          ? Number(req.body.captain_user_id ?? req.user.id)
          : req.user.id;

      const captainUser = await User.findOne({ where: { id: captainId } });
      if (!captainUser) {
        await transaction.rollback();
        return notFoundResponse(res, 'Capitán no válido');
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
        return badRequestResponse(res, 'El título del proyecto es obligatorio');
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

      return successResponse(res, serialized, 201);
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
        return notFoundResponse(res, 'Proyecto no encontrado');
      }

      // Validar que el proyecto esté activo
      if (project.status !== 'active') {
        await transaction.rollback();
        return conflictResponse(res, 'No puedes unirte a un proyecto inactivo');
      }

      const team = await findTeamOr404(project.team_id);
      const eventId = team.event_id;

      if (team.status !== 'open') {
        await transaction.rollback();
        return conflictResponse(res, 'El equipo no admite más miembros');
      }

      const activeMembers = team.members.filter(member => member.status === 'active');
      const eventMaxSize = team.event?.max_team_size ?? null;

      if (eventMaxSize && activeMembers.length >= eventMaxSize) {
        await transaction.rollback();
        return conflictResponse(res, 'El equipo ha alcanzado el tamaño máximo permitido');
      }

      if (team.members.some(member => member.user_id === req.user.id)) {
        await transaction.rollback();
        return conflictResponse(res, 'Ya perteneces a este equipo');
      }

      // Verificar si el usuario está en otro equipo del mismo evento
      const existingMembership = await TeamMember.findOne({
        where: { user_id: req.user.id },
        include: [
          {
            model: Team,
            as: 'team',
            attributes: ['id', 'event_id', 'captain_id'],
            where: { event_id: eventId }
          }
        ]
      });

      let previousTeamInfo = null;
      if (existingMembership) {
        const previousTeam = existingMembership.team;
        
        // Si el usuario es capitán del equipo anterior, validar restricciones
        if (previousTeam.captain_id === req.user.id) {
          const otherMembers = await TeamMember.findAll({
            where: {
              team_id: previousTeam.id,
              user_id: { [Op.ne]: req.user.id },
              status: 'active'
            }
          });

          // Si es el único miembro, no puede salirse
          if (otherMembers.length === 0) {
            await transaction.rollback();
            return conflictResponse(res, 'projects.cannotChangeTeamOnlyMember');
          }

          // Si hay otros miembros, debe asignar otro capitán primero
          await transaction.rollback();
          return conflictResponse(res, 'projects.mustAssignCaptainBeforeChange');
        }

        // Guardar información del equipo anterior antes de eliminarlo
        previousTeamInfo = {
          id: previousTeam.id,
          name: previousTeam.name
        };

        // Si no es capitán, eliminarlo automáticamente del equipo anterior
        await existingMembership.destroy({ transaction });
        
        logger.info('Usuario eliminado automáticamente de equipo anterior al unirse a nuevo proyecto', {
          previousTeamId: previousTeam.id,
          newTeamId: team.id,
          userId: req.user.id,
          tenantId: req.tenant.id
        });
      }

      await TeamMember.create(
        {
          tenant_id: req.tenant.id,
          team_id: team.id,
          user_id: req.user.id,
          role: 'member',
          status: 'active'
        },
        { transaction }
      );

      // Asegurar que el usuario tenga el rol participant
      await ensureParticipantRole(req.user.id, req.tenant.id, { transaction });

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

      return successResponse(res, {
        project: serialized,
        previousTeam: previousTeamInfo
      }, 201);
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
          attributes: ['id', 'name', 'description', 'requirements', 'status', 'captain_id', 'event_id'],
          include: [{ model: TeamMember, as: 'members' }]
        }]
      });

      if (!project) {
        return notFoundResponse(res, 'Proyecto no encontrado');
      }

      if (!(req.auth?.isSuperAdmin || canViewProject(req.user, project.team))) {
        return forbiddenResponse(res);
      }

      return successResponse(res, project);
    } catch (error) {
      next(error);
    }
  }

  static async update(req, res, next) {
    const transaction = await getSequelize().transaction();
    try {
      const { Project, Team, TeamMember } = getModels();
      const project = await Project.findOne({
        where: { id: req.params.projectId },
        include: [{
          model: Team,
          as: 'team',
          attributes: ['id', 'name', 'description', 'requirements', 'status', 'captain_id', 'event_id'],
          include: [{ model: TeamMember, as: 'members' }]
        }]
      });

      if (!project) {
        await transaction.rollback();
        return notFoundResponse(res, 'Proyecto no encontrado');
      }

      if (!project.team) {
        await transaction.rollback();
        return notFoundResponse(res, 'Equipo del proyecto no encontrado');
      }

      // Validar permisos para editar proyecto
      const roleScopes = req.user?.roleScopes ?? [];
      const isSuperAdmin = req.auth?.isSuperAdmin ?? false;
      const canEdit = canEditProject(req.user, project.team);
      
      logger.debug('Validación de permisos para editar proyecto', {
        userId: req.user?.id,
        projectId: project.id,
        teamId: project.team.id,
        teamCaptainId: project.team.captain_id,
        roleScopes,
        isSuperAdmin,
        canEdit,
        captainMatch: project.team.captain_id != null && req.user?.id != null 
          ? Number(project.team.captain_id) === Number(req.user.id) 
          : false
      });

      if (!(isSuperAdmin || canEdit)) {
        await transaction.rollback();
        return forbiddenResponse(res, 'No tienes permisos para editar este proyecto');
      }

      // Validar que solo superadmin y tenant_admin puedan cambiar el estado
      const newStatus = req.body.status ?? project.status;
      const statusChanged = newStatus !== project.status;
      if (statusChanged) {
        const roleScopes = getRoleScopes(req.user);
        const canChangeStatus = req.auth?.isSuperAdmin || roleScopes.includes('tenant_admin');
        if (!canChangeStatus) {
          await transaction.rollback();
          return forbiddenResponse(res, 'Solo administradores pueden cambiar el estado del proyecto');
        }
      }

      const wasActive = project.status === 'active';
      const willBeInactive = newStatus === 'inactive';

      // Manejar logo como base64 (similar a tenant)
      const wantsToRemoveLogo =
        Object.prototype.hasOwnProperty.call(req.body, 'logo') && req.body.logo === null;

      let uploadResult = null;
      const previousLogoUrl = project.logo_url;
      let logoUrl = req.body.logo_url;

      if (typeof req.body.logo === 'string' && req.body.logo.startsWith('data:')) {
        try {
          const { buffer, mimeType, extension } = decodeBase64Image(req.body.logo);
          uploadResult = await uploadProjectLogo({
            tenantId: req.tenant.id,
            projectId: project.id,
            buffer,
            contentType: mimeType,
            extension
          });
          logoUrl = uploadResult.url;
        } catch (uploadError) {
          await transaction.rollback();
          return badRequestResponse(res, uploadError.message);
        }
      } else if (wantsToRemoveLogo) {
        logoUrl = null;
      }

      await project.update({
        name: req.body.name ?? project.name,
        summary: req.body.summary,
        problem: req.body.problem,
        solution: req.body.solution,
        logo_url: logoUrl,
        repository_url: req.body.repository_url,
        pitch_url: req.body.pitch_url,
        status: newStatus
      }, { transaction });

      // Si el proyecto se vuelve inactivo, cerrar el equipo automáticamente
      if (wasActive && willBeInactive && project.team) {
        await project.team.update(
          { status: 'closed' },
          { transaction }
        );
      }

      await transaction.commit();

      // Limpiar logo anterior si se subió uno nuevo o se eliminó
      if (wantsToRemoveLogo && previousLogoUrl && !uploadResult) {
        await deleteObjectByUrl(previousLogoUrl).catch(error => {
          logger.warn('No se pudo eliminar el logo anterior del proyecto', {
            error: error.message,
            projectId: project.id
          });
        });
      }

      if (uploadResult && previousLogoUrl && previousLogoUrl !== uploadResult.url) {
        await deleteObjectByUrl(previousLogoUrl).catch(error => {
          logger.warn('No se pudo eliminar el logo anterior tras actualizarlo', {
            error: error.message,
            projectId: project.id
          });
        });
      }

      // Recargar el proyecto con las relaciones actualizadas
      const updatedProject = await Project.findOne({
        where: { id: project.id },
        include: [{
          model: Team,
          as: 'team',
          include: [{ model: TeamMember, as: 'members' }]
        }]
      });

      return successResponse(res, updatedProject);
    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  }
}

