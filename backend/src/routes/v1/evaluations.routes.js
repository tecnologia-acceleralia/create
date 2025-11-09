import { Router } from 'express';
import { body, param } from 'express-validator';
import { EvaluationsController } from '../../controllers/evaluations.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { authorizeRoles } from '../../middleware/authorization.middleware.js';
import { validateRequest } from '../../middleware/validation.middleware.js';

export const evaluationsRouter = Router();

evaluationsRouter.use(authenticate);

evaluationsRouter.post(
  '/submissions/:submissionId/evaluations/ai',
  authorizeRoles('tenant_admin', 'organizer', 'evaluator'),
  [
    param('submissionId').isInt(),
    body('locale').optional().isString()
  ],
  validateRequest,
  EvaluationsController.createAi
);

evaluationsRouter.post(
  '/submissions/:submissionId/evaluations',
  authorizeRoles('tenant_admin', 'organizer', 'evaluator'),
  [
    param('submissionId').isInt(),
    body('score').optional().isFloat({ min: 0 }),
    body('comment').optional().isString(),
    body('source').optional().isIn(['manual', 'ai_assisted']),
    body('rubric_snapshot').optional().isObject(),
    body('metadata').optional().isObject()
  ],
  validateRequest,
  EvaluationsController.create
);

evaluationsRouter.get(
  '/submissions/:submissionId/evaluations',
  [param('submissionId').isInt()],
  validateRequest,
  EvaluationsController.list
);

