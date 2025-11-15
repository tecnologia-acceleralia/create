import { getModels } from '../models/index.js';

export async function ensureUserNotInOtherTeam(userId, eventId) {
  const { TeamMember, Team } = getModels();
  const membership = await TeamMember.findOne({
    where: { user_id: userId },
    include: [
      {
        model: Team,
        as: 'team',
        attributes: ['id', 'event_id'],
        where: { event_id: eventId }
      }
    ]
  });

  if (membership) {
    const error = new Error('El usuario ya pertenece a un equipo en este evento');
    error.statusCode = 409;
    throw error;
  }
}

export async function findTeamOr404(teamId) {
  const { Team, TeamMember, User, Project, Event } = getModels();
  const team = await Team.findOne({
    where: { id: teamId },
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
        model: Project,
        as: 'project'
      },
      {
        model: Event,
        as: 'event'
      },
      {
        model: User,
        as: 'captain',
        attributes: ['id', 'email', 'first_name', 'last_name']
      }
    ]
  });

  if (!team) {
    const error = new Error('Equipo no encontrado');
    error.statusCode = 404;
    throw error;
  }

  return team;
}

