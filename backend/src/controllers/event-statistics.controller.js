import { Op } from 'sequelize';
import { getModels } from '../models/index.js';

export class EventStatisticsController {
  static async getStatistics(req, res, next) {
    try {
      const eventId = Number(req.params.eventId);
      if (Number.isNaN(eventId) || eventId <= 0) {
        return res.status(400).json({ success: false, message: 'Evento inválido' });
      }

      const {
        Event,
        Team,
        TeamMember,
        Project,
        EventRegistration,
        User,
        UserTenant,
        Role
      } = getModels();

      const event = await Event.findOne({ where: { id: eventId } });
      if (!event) {
        return res.status(404).json({ success: false, message: 'Evento no encontrado' });
      }

      // Obtener equipos con proyectos, capitanes y miembros
      const teams = await Team.findAll({
        where: { event_id: eventId },
        include: [
          {
            model: TeamMember,
            as: 'members',
            include: [
              {
                model: User,
                as: 'user',
                attributes: ['id', 'first_name', 'last_name', 'email', 'registration_answers']
              }
            ]
          },
          {
            model: Project,
            as: 'project'
          },
          {
            model: User,
            as: 'captain',
            attributes: ['id', 'first_name', 'last_name', 'email']
          }
        ],
        order: [['created_at', 'ASC']]
      });

      // Obtener todos los usuarios registrados en el evento
      const registrations = await EventRegistration.findAll({
        where: { event_id: eventId, status: 'registered' },
        attributes: ['id', 'user_id', 'grade', 'answers'],
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'first_name', 'last_name', 'email', 'last_login_at', 'registration_answers']
          }
        ],
        order: [[{ model: User, as: 'user' }, 'last_name', 'ASC']]
      });

      const userIds = registrations.map(reg => reg.user_id);

      // Obtener roles de los usuarios
      const tenantMemberships = await UserTenant.findAll({
        where: {
          user_id: { [Op.in]: userIds },
          tenant_id: event.tenant_id
        },
        include: [
          {
            model: Role,
            as: 'assignedRoles',
            attributes: ['id', 'name', 'scope'],
            through: { attributes: [] }
          }
        ]
      });

      const rolesByUserId = new Map();
      tenantMemberships.forEach(membership => {
        const roleScopes = membership.assignedRoles?.map(role => ({
          id: role.id,
          name: role.name,
          scope: role.scope
        })) ?? [];
        rolesByUserId.set(membership.user_id, roleScopes);
      });

      // Mapear usuarios a equipos
      const teamByUserId = new Map();
      teams.forEach(team => {
        team.members?.forEach(member => {
          teamByUserId.set(member.user_id, {
            teamId: team.id,
            teamName: team.name
          });
        });
      });

      // Preparar datos de equipos para la tabla
      const teamsData = teams.map(team => {
        const captain = team.members?.find(member => member.role === 'captain')?.user;
        // Filtrar miembros excluyendo al capitán
        const members = team.members
          ?.filter(member => member.role !== 'captain')
          .map(member => ({
            id: member.user?.id,
            firstName: member.user?.first_name,
            lastName: member.user?.last_name,
            email: member.user?.email,
            role: member.role,
            grade: member.user?.registration_answers?.grade || null
          })) ?? [];

        // Contar miembros totales (incluyendo capitán)
        const totalMembers = team.members?.length ?? 0;

        return {
          id: team.id,
          name: team.name,
          project: team.project
            ? {
                id: team.project.id,
                name: team.project.name,
                summary: team.project.summary,
                status: team.project.status
              }
            : null,
          captain: captain
            ? {
                id: captain.id,
                firstName: captain.first_name,
                lastName: captain.last_name,
                email: captain.email
              }
            : null,
          members,
          totalMembers
        };
      });

      // Preparar datos de usuarios
      const usersData = registrations.map(registration => {
        const user = registration.user;
        const roles = rolesByUserId.get(registration.user_id) ?? [];
        const teamInfo = teamByUserId.get(registration.user_id);

        return {
          id: registration.user_id,
          firstName: user?.first_name ?? null,
          lastName: user?.last_name ?? null,
          email: user?.email ?? null,
          grade: registration.grade ?? (user?.registration_answers?.grade || null),
          lastLoginAt: user?.last_login_at ?? null,
          team: teamInfo
            ? {
                id: teamInfo.teamId,
                name: teamInfo.teamName
              }
            : null,
          roles: roles.map(role => role.scope)
        };
      });

      // Usuarios sin equipos
      const usersWithoutTeam = usersData.filter(user => !user.team);

      // Agregados por grado
      const gradeSummary = new Map();
      usersData.forEach(user => {
        const grade = user.grade ?? '__NO_GRADE__';
        if (!gradeSummary.has(grade)) {
          gradeSummary.set(grade, { grade, withTeam: 0, withoutTeam: 0 });
        }
        const summary = gradeSummary.get(grade);
        if (user.team) {
          summary.withTeam += 1;
        } else {
          summary.withoutTeam += 1;
        }
      });

      const gradeSummaryArray = Array.from(gradeSummary.values()).map(entry => ({
        ...entry,
        total: entry.withTeam + entry.withoutTeam
      }));

      // Obtener campos custom del registration_schema si existe
      const registrationSchema = event.registration_schema;
      let customFields = [];
      if (registrationSchema && typeof registrationSchema === 'object' && Array.isArray(registrationSchema.fields)) {
        customFields = registrationSchema.fields
          .filter(field => field.type && field.name)
          .map(field => ({
            name: field.name,
            label: field.label || field.name,
            type: field.type
          }));
      }

      // Agregados por campos custom
      const customFieldAggregates = {};
      if (customFields.length > 0) {
        customFields.forEach(field => {
          const aggregate = new Map();
          registrations.forEach(registration => {
            const answers = registration.answers || {};
            const value = answers[field.name] ?? '__NO_VALUE__';
            const user = usersData.find(u => u.id === registration.user_id);
            const hasTeam = Boolean(user?.team);

            if (!aggregate.has(value)) {
              aggregate.set(value, { value, withTeam: 0, withoutTeam: 0 });
            }
            const entry = aggregate.get(value);
            if (hasTeam) {
              entry.withTeam += 1;
            } else {
              entry.withoutTeam += 1;
            }
          });

          customFieldAggregates[field.name] = {
            field: field,
            summary: Array.from(aggregate.values()).map(entry => ({
              ...entry,
              total: entry.withTeam + entry.withoutTeam
            }))
          };
        });
      }

      return res.json({
        success: true,
        data: {
          teams: teamsData,
          users: usersData,
          usersWithoutTeam,
          gradeSummary: gradeSummaryArray,
          customFields,
          customFieldAggregates
        }
      });
    } catch (error) {
      return next(error);
    }
  }
}

