import { Op } from 'sequelize';
import { getModels } from '../models/index.js';

function normalizeRegistrationAnswers(answers) {
  if (!answers || typeof answers !== 'object') {
    return null;
  }
  return answers;
}

const buildSubmissionKey = (teamId, taskId) => `${teamId}:${taskId}`;

function buildTeamDeliverables(tasks, teamId, submissionsIndex) {
  return tasks.map(task => {
    const submission = submissionsIndex.get(buildSubmissionKey(teamId, task.id)) ?? null;
    const delivered = Boolean(submission);

    return {
      taskId: task.id,
      taskTitle: task.title,
      required: Boolean(task.is_required),
      delivered,
      submittedAt: submission?.submitted_at ?? submission?.created_at ?? null,
      submissionId: submission?.id ?? null
    };
  });
}

export class EventTrackingController {
  static async overview(req, res, next) {
    try {
      const eventId = Number(req.params.eventId);
      if (Number.isNaN(eventId) || eventId <= 0) {
        return res.status(400).json({ success: false, message: 'Evento inválido' });
      }

      const {
        Event,
        Task,
        Team,
        TeamMember,
        Project,
        Submission,
        EventRegistration,
        User,
        UserTenant,
        Role
      } = getModels();

      const event = await Event.findOne({ where: { id: eventId } });
      if (!event) {
        return res.status(404).json({ success: false, message: 'Evento no encontrado' });
      }

      const [tasks, teams, registrations, submissions] = await Promise.all([
        Task.findAll({
          where: { event_id: eventId },
          order: [['created_at', 'ASC']]
        }),
        Team.findAll({
          where: { event_id: eventId },
          include: [
            {
              model: TeamMember,
              as: 'members',
              include: [
                {
                  model: User,
                  as: 'user',
                  attributes: ['id', 'first_name', 'last_name', 'email']
                }
              ]
            },
            {
              model: Project,
              as: 'project'
            }
          ],
          order: [
            ['created_at', 'ASC'],
            [{ model: TeamMember, as: 'members' }, 'created_at', 'ASC']
          ]
        }),
        EventRegistration.findAll({
          where: { event_id: eventId, status: 'registered' },
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'first_name', 'last_name', 'email', 'last_login_at', 'grade']
            }
          ],
          order: [[{ model: User, as: 'user' }, 'last_name', 'ASC']]
        }),
        Submission.findAll({
          where: { event_id: eventId },
          attributes: ['id', 'team_id', 'task_id', 'status', 'type', 'submitted_at', 'created_at']
        })
      ]);

      const userIds = registrations.map(registration => registration.user_id);

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

      const teamByUserId = new Map();
      teams.forEach(team => {
        team.members?.forEach(member => {
          teamByUserId.set(member.user_id, {
            teamId: team.id,
            teamName: team.name,
            role: member.role
          });
        });
      });

      const submissionsIndex = new Map();
      submissions.forEach(submission => {
        if (!submission.team_id || !submission.task_id) {
          return;
        }
        if (submission.status === 'draft') {
          return;
        }

        const key = buildSubmissionKey(submission.team_id, submission.task_id);
        const existing = submissionsIndex.get(key);
        if (!existing) {
          submissionsIndex.set(key, submission);
          return;
        }

        const submittedAt = submission.submitted_at ?? submission.created_at ?? null;
        const existingAt = existing.submitted_at ?? existing.created_at ?? null;

        if (submittedAt && existingAt) {
          if (new Date(submittedAt).getTime() > new Date(existingAt).getTime()) {
            submissionsIndex.set(key, submission);
          }
        } else if (submittedAt && !existingAt) {
          submissionsIndex.set(key, submission);
        }
      });

      const teamsWithDeliverables = teams.map(team => {
        const deliverables = buildTeamDeliverables(tasks, team.id, submissionsIndex);

        return {
          id: team.id,
          name: team.name,
          description: team.description,
          status: team.status,
          eventId: team.event_id,
          project: team.project ?? null,
          members: team.members?.map(member => ({
            id: member.id,
            userId: member.user_id,
            email: member.user?.email ?? null,
            firstName: member.user?.first_name ?? null,
            lastName: member.user?.last_name ?? null,
            role: member.role
          })) ?? [],
          deliverables
        };
      });

      const teamsById = new Map(teams.map(team => [team.id, team]));

      const users = registrations.map(registration => {
        const user = registration.user;
        const membership = rolesByUserId.get(registration.user_id) ?? [];
        const teamInfo = teamByUserId.get(registration.user_id) ?? null;
        const grade = registration.grade ?? user?.grade ?? null;

        return {
          id: registration.user_id,
          email: user?.email ?? null,
          firstName: user?.first_name ?? null,
          lastName: user?.last_name ?? null,
          lastLoginAt: user?.last_login_at ?? null,
          grade,
          registrationAnswers: normalizeRegistrationAnswers(registration.answers),
          team: teamInfo
            ? {
                id: teamInfo.teamId,
                name: teamsById.get(teamInfo.teamId)?.name ?? null,
                role: teamInfo.role
              }
            : null,
          roles: membership
        };
      });

      const registeredUserIds = new Set(registrations.map(reg => reg.user_id));
      const usersWithTeam = new Set(teamByUserId.keys());

      const unassignedUsers = users.filter(user => !usersWithTeam.has(user.id));

      const gradeSummaryMap = new Map();
      users.forEach(user => {
      const key = user.grade ?? '__NO_GRADE__';
        if (!gradeSummaryMap.has(key)) {
          gradeSummaryMap.set(key, { grade: key, withTeam: 0, withoutTeam: 0 });
        }
        const summary = gradeSummaryMap.get(key);
        if (usersWithTeam.has(user.id)) {
          summary.withTeam += 1;
        } else {
          summary.withoutTeam += 1;
        }
      });

      const gradeSummary = Array.from(gradeSummaryMap.values()).map(entry => ({
        ...entry,
        total: entry.withTeam + entry.withoutTeam
      }));

      return res.json({
        success: true,
        data: {
          event: {
            id: event.id,
            name: event.name,
            start_date: event.start_date,
            end_date: event.end_date,
            registration_schema: event.registration_schema ?? null
          },
          tasks: tasks.map(task => ({
            id: task.id,
            title: task.title,
            is_required: task.is_required
          })),
          teams: teamsWithDeliverables,
          users,
          unassignedUsers,
          gradeSummary,
          totals: {
            registrations: registeredUserIds.size,
            teams: teams.length,
            tasks: tasks.length
          }
        }
      });
    } catch (error) {
      return next(error);
    }
  }
}
