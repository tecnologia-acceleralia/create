import { Router } from 'express';
import { body, param } from 'express-validator';
import { ProjectsController } from '../../controllers/projects.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { authorizeRoles } from '../../middleware/authorization.middleware.js';
import { validateRequest } from '../../middleware/validation.middleware.js';

export const projectsRouter = Router();

projectsRouter.use(authenticate);

projectsRouter.get(
  '/:projectId',
  authorizeRoles('tenant_admin', 'organizer', 'evaluator', 'team_captain', 'participant'),
  [param('projectId').isInt()],
  validateRequest,
  ProjectsController.detail
);

projectsRouter.put(
  '/:projectId',
  authorizeRoles('tenant_admin', 'organizer', 'team_captain', 'participant'),
  [param('projectId').isInt()],
  validateRequest,
  ProjectsController.update
);

