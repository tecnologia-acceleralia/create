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
import { EventRegistrationModel } from './event-registration.model.js';
import { EvaluationModel } from './evaluation.model.js';
import { NotificationModel } from './notification.model.js';
import { PhaseRubricModel } from './phase-rubric.model.js';
import { PhaseRubricCriterionModel } from './phase-rubric-criterion.model.js';
import { SubmissionFileModel } from './submission-file.model.js';
import { UserTenantModel } from './user-tenant.model.js';
import { UserTenantRoleModel } from './user-tenant-role.model.js';
import { PasswordResetTokenModel } from './password-reset-token.model.js';
import { EventAssetModel } from './event-asset.model.js';

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
  models.EventRegistration = EventRegistrationModel(sequelize);
  models.Evaluation = EvaluationModel(sequelize);
  models.Notification = NotificationModel(sequelize);
  models.PhaseRubric = PhaseRubricModel(sequelize);
  models.PhaseRubricCriterion = PhaseRubricCriterionModel(sequelize);
  models.SubmissionFile = SubmissionFileModel(sequelize);
  models.UserTenant = UserTenantModel(sequelize);
  models.UserTenantRole = UserTenantRoleModel(sequelize);
  models.PasswordResetToken = PasswordResetTokenModel(sequelize);
  models.EventAsset = EventAssetModel(sequelize);

  models.Role.belongsTo(models.Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
  models.Tenant.hasMany(models.Role, { foreignKey: 'tenant_id', as: 'roles' });

  models.User.belongsToMany(models.Tenant, {
    through: models.UserTenant,
    foreignKey: 'user_id',
    otherKey: 'tenant_id',
    as: 'tenants'
  });
  models.Tenant.belongsToMany(models.User, {
    through: models.UserTenant,
    foreignKey: 'tenant_id',
    otherKey: 'user_id',
    as: 'users'
  });

  models.User.hasMany(models.UserTenant, { foreignKey: 'user_id', as: 'tenantMemberships' });
  models.UserTenant.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
  models.Tenant.hasMany(models.UserTenant, { foreignKey: 'tenant_id', as: 'userTenants' });
  models.UserTenant.belongsTo(models.Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

  models.UserTenant.belongsToMany(models.Role, {
    through: models.UserTenantRole,
    foreignKey: 'user_tenant_id',
    otherKey: 'role_id',
    as: 'assignedRoles'
  });
  models.Role.belongsToMany(models.UserTenant, {
    through: models.UserTenantRole,
    foreignKey: 'role_id',
    otherKey: 'user_tenant_id',
    as: 'assignedUserTenants'
  });

  models.UserTenant.hasMany(models.UserTenantRole, { foreignKey: 'user_tenant_id', as: 'roleAssignments' });
  models.UserTenantRole.belongsTo(models.UserTenant, { foreignKey: 'user_tenant_id', as: 'userTenant' });
  models.UserTenantRole.belongsTo(models.Role, { foreignKey: 'role_id', as: 'role' });
  models.Role.hasMany(models.UserTenantRole, { foreignKey: 'role_id', as: 'userTenantRoles' });
  models.UserTenantRole.belongsTo(models.Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
  models.Tenant.hasMany(models.UserTenantRole, { foreignKey: 'tenant_id', as: 'userTenantRoleAssignments' });

  models.Event.belongsTo(models.Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
  models.Tenant.hasMany(models.Event, { foreignKey: 'tenant_id', as: 'events' });

  models.Event.belongsTo(models.User, { foreignKey: 'created_by', as: 'creator' });
  models.User.hasMany(models.Event, { foreignKey: 'created_by', as: 'createdEvents' });

  models.Phase.belongsTo(models.Event, { foreignKey: 'event_id', as: 'event' });
  models.Event.hasMany(models.Phase, { foreignKey: 'event_id', as: 'phases' });

  models.PhaseRubric.belongsTo(models.Phase, { foreignKey: 'phase_id', as: 'phase' });
  models.Phase.hasMany(models.PhaseRubric, { foreignKey: 'phase_id', as: 'rubrics' });

  models.PhaseRubric.belongsTo(models.Event, { foreignKey: 'event_id', as: 'event' });
  models.Event.hasMany(models.PhaseRubric, { foreignKey: 'event_id', as: 'rubrics' });

  models.PhaseRubric.hasMany(models.PhaseRubricCriterion, { foreignKey: 'rubric_id', as: 'criteria' });
  models.PhaseRubricCriterion.belongsTo(models.PhaseRubric, { foreignKey: 'rubric_id', as: 'rubric' });

  models.Task.belongsTo(models.Event, { foreignKey: 'event_id', as: 'event' });
  models.Event.hasMany(models.Task, { foreignKey: 'event_id', as: 'tasks' });

  models.Task.belongsTo(models.Phase, { foreignKey: 'phase_id', as: 'phase' });
  models.Phase.hasMany(models.Task, { foreignKey: 'phase_id', as: 'tasks' });

  models.Task.belongsTo(models.PhaseRubric, { foreignKey: 'phase_rubric_id', as: 'rubric' });
  models.PhaseRubric.hasMany(models.Task, { foreignKey: 'phase_rubric_id', as: 'tasks' });

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

  models.Event.hasMany(models.EventRegistration, { foreignKey: 'event_id', as: 'registrations' });
  models.EventRegistration.belongsTo(models.Event, { foreignKey: 'event_id', as: 'event' });
  models.EventRegistration.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
  models.User.hasMany(models.EventRegistration, { foreignKey: 'user_id', as: 'eventRegistrations' });
  models.EventRegistration.belongsTo(models.Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
  models.Tenant.hasMany(models.EventRegistration, { foreignKey: 'tenant_id', as: 'eventRegistrations' });

  models.Submission.belongsTo(models.Event, { foreignKey: 'event_id', as: 'event' });
  models.Event.hasMany(models.Submission, { foreignKey: 'event_id', as: 'submissions' });

  models.Submission.belongsTo(models.Task, { foreignKey: 'task_id', as: 'task' });
  models.Task.hasMany(models.Submission, { foreignKey: 'task_id', as: 'submissions' });

  models.Submission.belongsTo(models.Team, { foreignKey: 'team_id', as: 'team' });
  models.Team.hasMany(models.Submission, { foreignKey: 'team_id', as: 'submissions' });

  models.Submission.belongsTo(models.User, { foreignKey: 'submitted_by', as: 'submitter' });
  models.User.hasMany(models.Submission, { foreignKey: 'submitted_by', as: 'submissions' });

  models.Submission.hasMany(models.SubmissionFile, { foreignKey: 'submission_id', as: 'files' });
  models.SubmissionFile.belongsTo(models.Submission, { foreignKey: 'submission_id', as: 'submission' });

  models.Evaluation.belongsTo(models.Submission, { foreignKey: 'submission_id', as: 'submission' });
  models.Submission.hasMany(models.Evaluation, { foreignKey: 'submission_id', as: 'evaluations' });

  models.Evaluation.belongsTo(models.Phase, { foreignKey: 'phase_id', as: 'phase' });
  models.Phase.hasMany(models.Evaluation, { foreignKey: 'phase_id', as: 'evaluations' });

  models.Evaluation.belongsTo(models.Project, { foreignKey: 'project_id', as: 'project' });
  models.Project.hasMany(models.Evaluation, { foreignKey: 'project_id', as: 'evaluations' });

  models.Evaluation.belongsTo(models.Team, { foreignKey: 'team_id', as: 'team' });
  models.Team.hasMany(models.Evaluation, { foreignKey: 'team_id', as: 'evaluations' });

  models.Evaluation.belongsTo(models.User, { foreignKey: 'reviewer_id', as: 'reviewer' });
  models.User.hasMany(models.Evaluation, { foreignKey: 'reviewer_id', as: 'evaluations' });

  models.Notification.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
  models.User.hasMany(models.Notification, { foreignKey: 'user_id', as: 'notifications' });

  models.PasswordResetToken.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
  models.User.hasMany(models.PasswordResetToken, { foreignKey: 'user_id', as: 'passwordResetTokens' });
  models.PasswordResetToken.belongsTo(models.Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
  models.Tenant.hasMany(models.PasswordResetToken, { foreignKey: 'tenant_id', as: 'passwordResetTokens' });

  models.EventAsset.belongsTo(models.Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
  models.Tenant.hasMany(models.EventAsset, { foreignKey: 'tenant_id', as: 'eventAssets' });

  models.EventAsset.belongsTo(models.Event, { foreignKey: 'event_id', as: 'event' });
  models.Event.hasMany(models.EventAsset, { foreignKey: 'event_id', as: 'assets' });

  models.EventAsset.belongsTo(models.User, { foreignKey: 'uploaded_by', as: 'uploader' });
  models.User.hasMany(models.EventAsset, { foreignKey: 'uploaded_by', as: 'uploadedAssets' });

  return models;
}

export const getModels = () => models;

