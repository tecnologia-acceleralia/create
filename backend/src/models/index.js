import { TenantModel } from './tenant.model.js';
import { RoleModel } from './role.model.js';
import { UserModel } from './user.model.js';
import { EventModel } from './event.model.js';
import { PhaseModel } from './phase.model.js';
import { TaskModel } from './task.model.js';
import { TeamModel } from './team.model.js';
import { TeamMemberModel } from './team-member.model.js';
import { ProjectModel } from './project.model.js';
import { SubmissionModel } from './submission.model.js';
import { EvaluationModel } from './evaluation.model.js';
import { NotificationModel } from './notification.model.js';

const models = {};

export function initModels(sequelize) {
  models.Tenant = TenantModel(sequelize);
  models.Role = RoleModel(sequelize);
  models.User = UserModel(sequelize);
  models.Event = EventModel(sequelize);
  models.Phase = PhaseModel(sequelize);
  models.Task = TaskModel(sequelize);
  models.Team = TeamModel(sequelize);
  models.TeamMember = TeamMemberModel(sequelize);
  models.Project = ProjectModel(sequelize);
  models.Submission = SubmissionModel(sequelize);
  models.Evaluation = EvaluationModel(sequelize);
  models.Notification = NotificationModel(sequelize);

  models.Role.belongsTo(models.Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
  models.Tenant.hasMany(models.Role, { foreignKey: 'tenant_id', as: 'roles' });

  models.User.belongsTo(models.Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
  models.Tenant.hasMany(models.User, { foreignKey: 'tenant_id', as: 'users' });

  models.User.belongsTo(models.Role, { foreignKey: 'role_id', as: 'role' });
  models.Role.hasMany(models.User, { foreignKey: 'role_id', as: 'users' });

  models.Event.belongsTo(models.Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
  models.Tenant.hasMany(models.Event, { foreignKey: 'tenant_id', as: 'events' });

  models.Event.belongsTo(models.User, { foreignKey: 'created_by', as: 'creator' });
  models.User.hasMany(models.Event, { foreignKey: 'created_by', as: 'createdEvents' });

  models.Phase.belongsTo(models.Event, { foreignKey: 'event_id', as: 'event' });
  models.Event.hasMany(models.Phase, { foreignKey: 'event_id', as: 'phases' });

  models.Task.belongsTo(models.Event, { foreignKey: 'event_id', as: 'event' });
  models.Event.hasMany(models.Task, { foreignKey: 'event_id', as: 'tasks' });

  models.Task.belongsTo(models.Phase, { foreignKey: 'phase_id', as: 'phase' });
  models.Phase.hasMany(models.Task, { foreignKey: 'phase_id', as: 'tasks' });

  models.Team.belongsTo(models.Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
  models.Tenant.hasMany(models.Team, { foreignKey: 'tenant_id', as: 'teams' });

  models.Team.belongsTo(models.Event, { foreignKey: 'event_id', as: 'event' });
  models.Event.hasMany(models.Team, { foreignKey: 'event_id', as: 'teams' });

  models.Team.belongsTo(models.User, { foreignKey: 'captain_id', as: 'captain' });
  models.User.hasMany(models.Team, { foreignKey: 'captain_id', as: 'captainTeams' });

  models.TeamMember.belongsTo(models.Team, { foreignKey: 'team_id', as: 'team' });
  models.Team.hasMany(models.TeamMember, { foreignKey: 'team_id', as: 'members' });

  models.TeamMember.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
  models.User.hasMany(models.TeamMember, { foreignKey: 'user_id', as: 'teamMemberships' });

  models.Project.belongsTo(models.Team, { foreignKey: 'team_id', as: 'team' });
  models.Team.hasOne(models.Project, { foreignKey: 'team_id', as: 'project' });

  models.Project.belongsTo(models.Event, { foreignKey: 'event_id', as: 'event' });
  models.Event.hasMany(models.Project, { foreignKey: 'event_id', as: 'projects' });

  models.Submission.belongsTo(models.Event, { foreignKey: 'event_id', as: 'event' });
  models.Event.hasMany(models.Submission, { foreignKey: 'event_id', as: 'submissions' });

  models.Submission.belongsTo(models.Task, { foreignKey: 'task_id', as: 'task' });
  models.Task.hasMany(models.Submission, { foreignKey: 'task_id', as: 'submissions' });

  models.Submission.belongsTo(models.Team, { foreignKey: 'team_id', as: 'team' });
  models.Team.hasMany(models.Submission, { foreignKey: 'team_id', as: 'submissions' });

  models.Submission.belongsTo(models.User, { foreignKey: 'submitted_by', as: 'submitter' });
  models.User.hasMany(models.Submission, { foreignKey: 'submitted_by', as: 'submissions' });

  models.Evaluation.belongsTo(models.Submission, { foreignKey: 'submission_id', as: 'submission' });
  models.Submission.hasMany(models.Evaluation, { foreignKey: 'submission_id', as: 'evaluations' });

  models.Evaluation.belongsTo(models.User, { foreignKey: 'reviewer_id', as: 'reviewer' });
  models.User.hasMany(models.Evaluation, { foreignKey: 'reviewer_id', as: 'evaluations' });

  models.Notification.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
  models.User.hasMany(models.Notification, { foreignKey: 'user_id', as: 'notifications' });

  return models;
}

export const getModels = () => models;

