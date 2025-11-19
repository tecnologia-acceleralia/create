import { Router } from 'express';
import { body, param } from 'express-validator';
import { TeamsController } from '../../controllers/teams.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { authorizeRoles } from '../../middleware/authorization.middleware.js';
import { validateRequest } from '../../middleware/validation.middleware.js';

export const teamsRouter = Router();

teamsRouter.use(authenticate);

// Rutas específicas primero (más segmentos de ruta)
teamsRouter.get(
  '/events/:eventId',
  authorizeRoles('tenant_admin', 'organizer', 'evaluator', 'participant', 'team_captain'),
  [param('eventId').isInt()],
  validateRequest,
  TeamsController.listByEvent
);

teamsRouter.get('/my', TeamsController.myTeams);

teamsRouter.delete(
  '/:teamId/members/:userId',
  authorizeRoles('tenant_admin', 'team_captain'),
  [param('teamId').isInt(), param('userId').isInt()],
  validateRequest,
  TeamsController.removeMember
);

teamsRouter.post(
  '/:teamId/members',
  authorizeRoles('tenant_admin', 'team_captain'),
  [param('teamId').isInt(), body('user_id').optional().isInt(), body('user_email').optional().isEmail()],
  validateRequest,
  TeamsController.addMember
);

teamsRouter.patch(
  '/:teamId/captain',
  authorizeRoles('tenant_admin', 'team_captain'),
  [param('teamId').isInt(), body('user_id').isInt()],
  validateRequest,
  TeamsController.setCaptain
);

teamsRouter.patch(
  '/:teamId/status',
  authorizeRoles('tenant_admin', 'team_captain'),
  [param('teamId').isInt(), body('status').isIn(['open', 'closed'])],
  validateRequest,
  TeamsController.updateStatus
);

teamsRouter.post(
  '/:teamId/join',
  authorizeRoles('participant', 'team_captain'),
  [param('teamId').isInt()],
  validateRequest,
  TeamsController.joinTeam
);

teamsRouter.post(
  '/:teamId/leave',
  authorizeRoles('participant', 'team_captain'),
  [param('teamId').isInt()],
  validateRequest,
  TeamsController.leaveTeam
);

// Rutas genéricas al final (menos segmentos de ruta)
teamsRouter.post(
  '/',
  authorizeRoles('tenant_admin', 'participant', 'team_captain'),
  [
    body('event_id').isInt(),
    body('name').isString().notEmpty(),
    body('captain_user_id').optional().isInt()
  ],
  validateRequest,
  TeamsController.create
);

teamsRouter.get(
  '/:teamId',
  authorizeRoles('tenant_admin', 'organizer', 'evaluator'),
  [param('teamId').isInt()],
  validateRequest,
  TeamsController.detail
);

