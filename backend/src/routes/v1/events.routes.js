import { Router } from 'express';
import { body, param } from 'express-validator';
import { EventsController } from '../../controllers/events.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { authorizeRoles } from '../../middleware/authorization.middleware.js';
import { validateRequest } from '../../middleware/validation.middleware.js';

export const eventsRouter = Router();

eventsRouter.use(authenticate);

eventsRouter.get('/', EventsController.list);
eventsRouter.post(
  '/',
  authorizeRoles('tenant_admin'),
  [
    body('name').isString().notEmpty(),
    body('description').optional().isString(),
    body('start_date').isISO8601(),
    body('end_date').isISO8601(),
    body('min_team_size').optional().isInt({ min: 1 }),
    body('max_team_size').optional().isInt({ min: 1 })
  ],
  validateRequest,
  EventsController.create
);

eventsRouter.get('/:eventId', param('eventId').isInt(), validateRequest, EventsController.detail);
eventsRouter.put(
  '/:eventId',
  authorizeRoles('tenant_admin'),
  [param('eventId').isInt()],
  validateRequest,
  EventsController.update
);
eventsRouter.delete(
  '/:eventId',
  authorizeRoles('tenant_admin'),
  [param('eventId').isInt()],
  validateRequest,
  EventsController.archive
);

eventsRouter.get('/:eventId/phases', [param('eventId').isInt()], validateRequest, EventsController.listPhases);
eventsRouter.post(
  '/:eventId/phases',
  authorizeRoles('tenant_admin'),
  [
    param('eventId').isInt(),
    body('name').isString().notEmpty(),
    body('order_index').optional().isInt({ min: 1 }),
    body('is_elimination').optional().isBoolean()
  ],
  validateRequest,
  EventsController.createPhase
);
eventsRouter.put(
  '/:eventId/phases/:phaseId',
  authorizeRoles('tenant_admin'),
  [param('eventId').isInt(), param('phaseId').isInt()],
  validateRequest,
  EventsController.updatePhase
);
eventsRouter.delete(
  '/:eventId/phases/:phaseId',
  authorizeRoles('tenant_admin'),
  [param('eventId').isInt(), param('phaseId').isInt()],
  validateRequest,
  EventsController.deletePhase
);

eventsRouter.get('/:eventId/tasks', [param('eventId').isInt()], validateRequest, EventsController.listTasks);
eventsRouter.post(
  '/:eventId/tasks',
  authorizeRoles('tenant_admin', 'organizer'),
  [
    param('eventId').isInt(),
    body('title').isString().notEmpty(),
    body('phase_id').isInt(),
    body('delivery_type').optional().isIn(['text', 'file', 'url', 'video', 'audio', 'zip']),
    body('is_required').optional().isBoolean()
  ],
  validateRequest,
  EventsController.createTask
);
eventsRouter.put(
  '/:eventId/tasks/:taskId',
  authorizeRoles('tenant_admin', 'organizer'),
  [param('eventId').isInt(), param('taskId').isInt()],
  validateRequest,
  EventsController.updateTask
);
eventsRouter.delete(
  '/:eventId/tasks/:taskId',
  authorizeRoles('tenant_admin'),
  [param('eventId').isInt(), param('taskId').isInt()],
  validateRequest,
  EventsController.deleteTask
);

