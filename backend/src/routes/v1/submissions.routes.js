import { Router } from 'express';
import { body, param } from 'express-validator';
import { SubmissionsController } from '../../controllers/submissions.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { validateRequest } from '../../middleware/validation.middleware.js';

export const submissionsRouter = Router();

submissionsRouter.use(authenticate);

submissionsRouter.post(
  '/tasks/:taskId/submissions',
  [
    param('taskId').isInt(),
    body('content').optional().isString(),
    body('attachment_url').optional().isString(),
    body('status').optional().isIn(['draft', 'final']),
    body('type').optional().isIn(['provisional', 'final']),
    body('team_id').optional().isInt(),
    body('files').optional().isArray(),
    body('files.*.base64').optional().isString(),
    body('files.*.name').optional().isString()
  ],
  validateRequest,
  SubmissionsController.create
);

submissionsRouter.get(
  '/tasks/:taskId/submissions',
  [param('taskId').isInt()],
  validateRequest,
  SubmissionsController.listByTask
);

submissionsRouter.get(
  '/submissions/:submissionId',
  [param('submissionId').isInt()],
  validateRequest,
  SubmissionsController.detail
);

