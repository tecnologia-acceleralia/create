import { Router } from 'express';
import { param } from 'express-validator';
import { NotificationsController } from '../../controllers/notifications.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { validateRequest } from '../../middleware/validation.middleware.js';

export const notificationsRouter = Router();

notificationsRouter.use(authenticate);

notificationsRouter.get('/', NotificationsController.list);

notificationsRouter.patch(
  '/:notificationId/read',
  [param('notificationId').isInt()],
  validateRequest,
  NotificationsController.markRead
);

