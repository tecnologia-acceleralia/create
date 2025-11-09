import { Router } from 'express';
import { body, param } from 'express-validator';
import { TeamsController } from '../../controllers/teams.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { authorizeRoles } from '../../middleware/authorization.middleware.js';
import { validateRequest } from '../../middleware/validation.middleware.js';

export const teamsRouter = Router();

teamsRouter.use(authenticate);

teamsRouter.get(
  '/events/:eventId',
  authorizeRoles('tenant_admin', 'organizer', 'evaluator'),
  [param('eventId').isInt()],
  validateRequest,
  TeamsController.listByEvent
);

teamsRouter.get('/my', TeamsController.myTeams);

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

teamsRouter.post(
  '/:teamId/members',
  authorizeRoles('tenant_admin', 'team_captain'),
  [param('teamId').isInt(), body('user_id').optional().isInt(), body('user_email').optional().isEmail()],
  validateRequest,
  TeamsController.addMember
);

teamsRouter.delete(
  '/:teamId/members/:userId',
  authorizeRoles('tenant_admin', 'team_captain'),
  [param('teamId').isInt(), param('userId').isInt()],
  validateRequest,
  TeamsController.removeMember
);

teamsRouter.patch(
  '/:teamId/captain',
  authorizeRoles('tenant_admin', 'team_captain'),
  [param('teamId').isInt(), body('user_id').isInt()],
  validateRequest,
  TeamsController.setCaptain
);

