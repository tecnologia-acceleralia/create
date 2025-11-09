import { getModels } from '../models/index.js';

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

