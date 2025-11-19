import { getSequelize } from '../database/database.js';
import { getModels } from '../models/index.js';
import { logger } from '../utils/logger.js';
import { ensureUserNotInOtherTeam, findTeamOr404 } from '../services/team.service.js';
import { isTenantAdmin, canManageTeam } from '../utils/authorization.js';
import { successResponse, notFoundResponse, forbiddenResponse, badRequestResponse, conflictResponse } from '../utils/response.js';
import { ensureParticipantRole, ensureTeamCaptainRole, removeTeamCaptainRole } from '../utils/role-management.js';
import { Op } from 'sequelize';

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
      return successResponse(res, teams);
    } catch (error) {
      next(error);
    }
  }

  static async myTeams(req, res, next) {
    try {
      // Los superadmins no pertenecen a equipos de tenants
      const isSuperAdmin = Boolean(req.auth?.isSuperAdmin ?? req.user?.is_super_admin);
      if (isSuperAdmin) {
        return successResponse(res, []);
      }

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
              { 
                model: TeamMember, 
                as: 'members', 
                include: [{ model: User, as: 'user', attributes: ['id', 'email', 'first_name', 'last_name'] }] 
              }
            ]
          }
        ]
      });

      return successResponse(res, memberships);
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

      const captainId = isTenantAdmin(req) && req.body.captain_user_id
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
        tenant_id: req.tenant.id,
        team_id: team.id,
        user_id: captainId,
        role: 'captain'
      }, { transaction });

      // Asegurar que el capitán tenga el rol team_captain
      await ensureTeamCaptainRole(captainId, req.tenant.id, { transaction });

      await Project.create({
        team_id: team.id,
        event_id: eventId,
        name: req.body.project_name ?? req.body.name,
        summary: req.body.project_summary
      }, { transaction });

      await transaction.commit();

      const createdTeam = await findTeamOr404(team.id);
      logger.info('Equipo creado', { teamId: team.id, tenantId: req.tenant.id });
      return successResponse(res, createdTeam, 201);
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

      if (!canManageTeam(req, team)) {
        return forbiddenResponse(res);
      }

      let userId = req.body.user_id ? Number(req.body.user_id) : null;

      if (!userId && req.body.user_email) {
        const user = await User.findOne({ where: { email: req.body.user_email } });
        if (!user) {
          await transaction.rollback();
          return notFoundResponse(res, 'Usuario no encontrado');
        }
        userId = user.id;
      }

      if (!userId) {
        await transaction.rollback();
        return badRequestResponse(res, 'Debes indicar user_id o user_email');
      }

      await ensureUserNotInOtherTeam(userId, team.event_id);

      const member = await TeamMember.create({
        tenant_id: req.tenant.id,
        team_id: team.id,
        user_id: userId,
        role: req.body.role ?? 'member',
        status: 'active'
      }, { transaction });

      // Asegurar que el miembro tenga el rol participant
      await ensureParticipantRole(userId, req.tenant.id, { transaction });

      await transaction.commit();
      return successResponse(res, member, 201);
    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  }

  static async removeMember(req, res, next) {
    try {
      const { TeamMember } = getModels();
      const team = await findTeamOr404(req.params.teamId);

      const userIdToRemove = Number(req.params.userId);
      const isSelfRemoval = userIdToRemove === req.user.id;

      // Si no es auto-eliminación, requiere permisos de gestión
      if (!isSelfRemoval && !canManageTeam(req, team)) {
        return forbiddenResponse(res);
      }

      const member = await TeamMember.findOne({
        where: { team_id: team.id, user_id: userIdToRemove }
      });

      if (!member) {
        return notFoundResponse(res, 'Miembro no encontrado');
      }

      // Si es capitán, validar que haya otro miembro que pueda ser capitán
      if (member.user_id === team.captain_id) {
        const otherMembers = await TeamMember.findAll({
          where: {
            team_id: team.id,
            user_id: { [Op.ne]: userIdToRemove }
          }
        });

        if (otherMembers.length === 0) {
          return badRequestResponse(res, 'No puedes eliminar al capitán si es el único miembro del equipo');
        }

        // Si es auto-eliminación del capitán, debe haber asignado otro capitán primero
        if (isSelfRemoval) {
          return badRequestResponse(res, 'Debes asignar otro capitán antes de abandonar el equipo');
        }
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

      if (!canManageTeam(req, team)) {
        return forbiddenResponse(res);
      }

      const newCaptainId = Number(req.body.user_id);
      const member = await TeamMember.findOne({
        where: { team_id: team.id, user_id: newCaptainId }
      });

      if (!member) {
        await transaction.rollback();
        return notFoundResponse(res, 'El usuario no es miembro del equipo');
      }

      // Si hay un capitán anterior, cambiar su rol a 'member'
      if (team.captain_id && team.captain_id !== newCaptainId) {
        const previousCaptain = await TeamMember.findOne({
          where: { team_id: team.id, user_id: team.captain_id }
        });
        if (previousCaptain) {
          await previousCaptain.update({ role: 'member' }, { transaction });
          // Remover rol team_captain del capitán anterior (solo si no es capitán de otro equipo)
          const otherTeamsAsCaptain = await TeamMember.count({
            where: {
              user_id: team.captain_id,
              role: 'captain',
              team_id: { [Op.ne]: team.id }
            },
            transaction
          });
          if (otherTeamsAsCaptain === 0) {
            await removeTeamCaptainRole(team.captain_id, req.tenant.id, { transaction });
          }
        }
      }

      // Actualizar el nuevo capitán
      await member.update({ role: 'captain' }, { transaction });
      await Team.update({ captain_id: newCaptainId }, { where: { id: team.id }, transaction });

      // Asegurar que el nuevo capitán tenga el rol team_captain
      await ensureTeamCaptainRole(newCaptainId, req.tenant.id, { transaction });

      await transaction.commit();
      return successResponse(res, { success: true });
    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  }

  static async detail(req, res, next) {
    try {
      const team = await findTeamOr404(req.params.teamId);
      return successResponse(res, team);
    } catch (error) {
      next(error);
    }
  }

  static async updateStatus(req, res, next) {
    const transaction = await getSequelize().transaction();
    try {
      const { Project } = getModels();
      const team = await findTeamOr404(req.params.teamId);

      // Validar que solo superadmin, tenant_admin y capitán puedan cambiar el estado
      if (!canManageTeam(req, team)) {
        await transaction.rollback();
        return forbiddenResponse(res, 'No autorizado para cambiar el estado del equipo');
      }

      const newStatus = req.body.status;
      if (!['open', 'closed'].includes(newStatus)) {
        await transaction.rollback();
        return badRequestResponse(res, 'Estado inválido. Debe ser "open" o "closed"');
      }

      // Si se intenta abrir el equipo, validar que el proyecto esté activo
      if (newStatus === 'open') {
        const project = await Project.findOne({ where: { team_id: team.id } });
        if (project && project.status !== 'active') {
          await transaction.rollback();
          return conflictResponse(res, 'No se puede abrir un equipo cuyo proyecto está inactivo');
        }
      }

      await team.update({ status: newStatus }, { transaction });
      await transaction.commit();

      const updatedTeam = await findTeamOr404(team.id);
      logger.info('Estado del equipo actualizado', {
        teamId: team.id,
        newStatus,
        userId: req.user.id,
        tenantId: req.tenant.id
      });

      return successResponse(res, updatedTeam);
    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  }

  /**
   * Permite a un usuario unirse a un equipo.
   * Si ya está en otro equipo del mismo evento, lo abandona automáticamente.
   * Siempre se une como miembro (no como capitán).
   */
  static async joinTeam(req, res, next) {
    const transaction = await getSequelize().transaction();
    try {
      const { TeamMember, Team } = getModels();
      const team = await findTeamOr404(req.params.teamId);
      const userId = req.user.id;

      // Verificar si el equipo está abierto
      if (team.status !== 'open') {
        await transaction.rollback();
        return badRequestResponse(res, 'El equipo no está abierto para nuevos miembros');
      }

      // Verificar si ya es miembro de este equipo
      const existingMember = await TeamMember.findOne({
        where: { team_id: team.id, user_id: userId }
      });

      if (existingMember) {
        await transaction.rollback();
        return conflictResponse(res, 'Ya eres miembro de este equipo');
      }

      // Buscar si está en otro equipo del mismo evento
      const otherMemberships = await TeamMember.findAll({
        where: { user_id: userId },
        include: [
          {
            model: Team,
            as: 'team',
            attributes: ['id', 'event_id', 'captain_id']
          }
        ]
      });

      const otherMembership = otherMemberships.find(m => m.team.event_id === team.event_id);

      // Si está en otro equipo, abandonarlo primero
      if (otherMembership) {
        // Si es capitán del otro equipo, no puede abandonarlo sin asignar otro capitán
        if (otherMembership.team.captain_id === userId) {
          await transaction.rollback();
          return badRequestResponse(res, 'Debes asignar otro capitán a tu equipo actual antes de unirte a otro equipo');
        }

        await otherMembership.destroy({ transaction });
        logger.info('Usuario abandonó equipo anterior al unirse a uno nuevo', {
          userId,
          oldTeamId: otherMembership.team.id,
          newTeamId: team.id,
          tenantId: req.tenant.id
        });
      }

      // Unirse al nuevo equipo como miembro
      const newMember = await TeamMember.create({
        tenant_id: req.tenant.id,
        team_id: team.id,
        user_id: userId,
        role: 'member',
        status: 'active'
      }, { transaction });

      // Asegurar que el usuario tenga el rol participant
      await ensureParticipantRole(userId, req.tenant.id, { transaction });

      await transaction.commit();

      logger.info('Usuario se unió a un equipo', {
        userId,
        teamId: team.id,
        tenantId: req.tenant.id
      });

      const updatedTeam = await findTeamOr404(team.id);
      return successResponse(res, { member: newMember, team: updatedTeam }, 201);
    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  }

  /**
   * Permite a un usuario abandonar su equipo.
   * Si es capitán, debe haber asignado otro capitán primero.
   */
  static async leaveTeam(req, res, next) {
    const transaction = await getSequelize().transaction();
    try {
      const { TeamMember, Team } = getModels();
      const team = await findTeamOr404(req.params.teamId);
      const userId = req.user.id;

      const member = await TeamMember.findOne({
        where: { team_id: team.id, user_id: userId }
      });

      if (!member) {
        await transaction.rollback();
        return notFoundResponse(res, 'No eres miembro de este equipo');
      }

      // Si es capitán, validar que haya otro capitán asignado
      if (team.captain_id === userId) {
        // Verificar si hay otro miembro que pueda ser capitán
        const otherMembers = await TeamMember.findAll({
          where: {
            team_id: team.id,
            user_id: { [Op.ne]: userId }
          }
        });

        if (otherMembers.length === 0) {
          await transaction.rollback();
          return badRequestResponse(res, 'No puedes abandonar el equipo si eres el único miembro');
        }

        // Verificar si hay otro capitán asignado (no debería pasar, pero por seguridad)
        const hasOtherCaptain = otherMembers.some(m => m.role === 'captain');
        if (!hasOtherCaptain) {
          await transaction.rollback();
          return badRequestResponse(res, 'Debes asignar otro capitán antes de abandonar el equipo');
        }

        // Remover rol team_captain si ya no es capitán de ningún otro equipo
        const otherTeamsAsCaptain = await TeamMember.count({
          where: {
            user_id: userId,
            role: 'captain',
            team_id: { [Op.ne]: team.id }
          },
          transaction
        });
        if (otherTeamsAsCaptain === 0) {
          await removeTeamCaptainRole(userId, req.tenant.id, { transaction });
        }
      }

      await member.destroy({ transaction });
      await transaction.commit();

      logger.info('Usuario abandonó un equipo', {
        userId,
        teamId: team.id,
        wasCaptain: team.captain_id === userId,
        tenantId: req.tenant.id
      });

      res.status(204).send();
    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  }
}

