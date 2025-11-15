import { Router } from 'express';
import { body, param } from 'express-validator';
import { EventsController } from '../../controllers/events.controller.js';
import { EventTrackingController } from '../../controllers/event-tracking.controller.js';
import { EventAssetsController, uploadMiddleware } from '../../controllers/event-assets.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { authorizeRoles } from '../../middleware/authorization.middleware.js';
import { validateRequest } from '../../middleware/validation.middleware.js';

export const eventsRouter = Router();

eventsRouter.use(authenticate);

eventsRouter.get('/', authorizeRoles('tenant_admin', 'organizer', 'evaluator', 'participant', 'team_captain'), EventsController.list);
eventsRouter.post(
  '/',
  authorizeRoles('tenant_admin'),
  [
    body('name').isString().notEmpty(),
    body('description').optional().isString(),
    body('start_date').isISO8601(),
    body('end_date').isISO8601(),
    body('min_team_size').optional().isInt({ min: 1 }),
    body('max_team_size').optional().isInt({ min: 1 }),
    body('video_url').optional({ checkFalsy: true }).isURL().withMessage('URL de video inválida'),
    body('is_public').optional().isBoolean().toBoolean(),
    body('publish_start_at').optional({ checkFalsy: true }).isISO8601().toDate(),
    body('publish_end_at').optional({ checkFalsy: true }).isISO8601().toDate(),
    body().custom(value => {
      if (value.is_public && (!value.publish_start_at || !value.publish_end_at)) {
        throw new Error('Las fechas de publicación son obligatorias para eventos públicos');
      }
      if (value.publish_start_at && value.publish_end_at) {
        const startTime = new Date(value.publish_start_at).getTime();
        const endTime = new Date(value.publish_end_at).getTime();
        if (startTime > endTime) {
          throw new Error('La fecha de fin debe ser posterior a la fecha de inicio');
        }
      }
      return true;
    })
  ],
  validateRequest,
  EventsController.create
);

eventsRouter.get(
  '/:eventId',
  authorizeRoles('tenant_admin', 'organizer', 'evaluator', 'participant', 'team_captain'),
  [param('eventId').isInt()],
  validateRequest,
  EventsController.detail
);

eventsRouter.get(
  '/:eventId/tracking/overview',
  authorizeRoles('tenant_admin', 'organizer', 'evaluator'),
  [param('eventId').isInt()],
  validateRequest,
  EventTrackingController.overview
);

eventsRouter.put(
  '/:eventId',
  authorizeRoles('tenant_admin'),
  [
    param('eventId').isInt(),
    body('name').optional().isString().notEmpty(),
    body('description').optional().isString(),
    body('start_date').optional().isISO8601(),
    body('end_date').optional().isISO8601(),
    body('min_team_size').optional().isInt({ min: 1 }),
    body('max_team_size').optional().isInt({ min: 1 }),
    body('video_url').optional({ checkFalsy: true }).isURL().withMessage('URL de video inválida'),
    body('is_public').optional().isBoolean().toBoolean(),
    body('publish_start_at').optional({ checkFalsy: true }).isISO8601().toDate(),
    body('publish_end_at').optional({ checkFalsy: true }).isISO8601().toDate(),
    body().custom(value => {
      if (value.is_public && (!value.publish_start_at || !value.publish_end_at)) {
        throw new Error('Las fechas de publicación son obligatorias para eventos públicos');
      }
      if (value.publish_start_at && value.publish_end_at) {
        const startTime = new Date(value.publish_start_at).getTime();
        const endTime = new Date(value.publish_end_at).getTime();
        if (startTime > endTime) {
          throw new Error('La fecha de fin debe ser posterior a la fecha de inicio');
        }
      }
      return true;
    })
  ],
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
    body('description').optional({ nullable: true }).isString(),
    body('intro_html').optional({ nullable: true }).isString(),
    body('order_index').optional().isInt({ min: 1 }),
    body('is_elimination').optional().isBoolean(),
    body('start_date')
      .optional({ nullable: true, checkFalsy: true })
      .custom(value => value === null || !Number.isNaN(Date.parse(value)))
      .withMessage('Fecha de inicio inválida')
      .customSanitizer(value => (value === null || value === '' ? null : new Date(value))),
    body('end_date')
      .optional({ nullable: true, checkFalsy: true })
      .custom(value => value === null || !Number.isNaN(Date.parse(value)))
      .withMessage('Fecha de fin inválida')
      .customSanitizer(value => (value === null || value === '' ? null : new Date(value))),
    body('view_start_date')
      .optional({ nullable: true, checkFalsy: true })
      .custom(value => value === null || !Number.isNaN(Date.parse(value)))
      .withMessage('Fecha de inicio de visualización inválida')
      .customSanitizer(value => (value === null || value === '' ? null : new Date(value))),
    body('view_end_date')
      .optional({ nullable: true, checkFalsy: true })
      .custom(value => value === null || !Number.isNaN(Date.parse(value)))
      .withMessage('Fecha de fin de visualización inválida')
      .customSanitizer(value => (value === null || value === '' ? null : new Date(value))),
    body().custom(value => {
      const startDate = value.start_date ? new Date(value.start_date).getTime() : null;
      const endDate = value.end_date ? new Date(value.end_date).getTime() : null;
      if (startDate && endDate && startDate > endDate) {
        throw new Error('La fecha de fin debe ser posterior o igual a la fecha de inicio');
      }
      const viewStart = value.view_start_date ? new Date(value.view_start_date).getTime() : null;
      const viewEnd = value.view_end_date ? new Date(value.view_end_date).getTime() : null;
      if (viewStart && viewEnd && viewStart > viewEnd) {
        throw new Error('La fecha fin de visualización debe ser posterior o igual a la fecha de inicio de visualización');
      }
      return true;
    })
  ],
  validateRequest,
  EventsController.createPhase
);
eventsRouter.put(
  '/:eventId/phases/:phaseId',
  authorizeRoles('tenant_admin'),
  [
    param('eventId').isInt(),
    param('phaseId').isInt(),
    body('name').optional().isString().notEmpty(),
    body('description').optional({ nullable: true }).isString(),
    body('intro_html').optional({ nullable: true }).isString(),
    body('order_index').optional().isInt({ min: 1 }),
    body('is_elimination').optional().isBoolean(),
    body('start_date')
      .optional({ nullable: true, checkFalsy: true })
      .custom(value => value === null || !Number.isNaN(Date.parse(value)))
      .withMessage('Fecha de inicio inválida')
      .customSanitizer(value => (value === null || value === '' ? null : new Date(value))),
    body('end_date')
      .optional({ nullable: true, checkFalsy: true })
      .custom(value => value === null || !Number.isNaN(Date.parse(value)))
      .withMessage('Fecha de fin inválida')
      .customSanitizer(value => (value === null || value === '' ? null : new Date(value))),
    body('view_start_date')
      .optional({ nullable: true, checkFalsy: true })
      .custom(value => value === null || !Number.isNaN(Date.parse(value)))
      .withMessage('Fecha de inicio de visualización inválida')
      .customSanitizer(value => (value === null || value === '' ? null : new Date(value))),
    body('view_end_date')
      .optional({ nullable: true, checkFalsy: true })
      .custom(value => value === null || !Number.isNaN(Date.parse(value)))
      .withMessage('Fecha de fin de visualización inválida')
      .customSanitizer(value => (value === null || value === '' ? null : new Date(value))),
    body().custom(value => {
      const startDate = value.start_date ? new Date(value.start_date).getTime() : null;
      const endDate = value.end_date ? new Date(value.end_date).getTime() : null;
      if (startDate && endDate && startDate > endDate) {
        throw new Error('La fecha de fin debe ser posterior o igual a la fecha de inicio');
      }
      const viewStart = value.view_start_date ? new Date(value.view_start_date).getTime() : null;
      const viewEnd = value.view_end_date ? new Date(value.view_end_date).getTime() : null;
      if (viewStart && viewEnd && viewStart > viewEnd) {
        throw new Error('La fecha fin de visualización debe ser posterior o igual a la fecha de inicio de visualización');
      }
      return true;
    })
  ],
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
  authorizeRoles('tenant_admin'),
  [
    param('eventId').isInt(),
    body('title').isString().notEmpty(),
    body('phase_id').isInt(),
    body('delivery_type').optional().isIn(['text', 'file', 'url', 'video', 'audio', 'zip']),
    body('intro_html').optional({ nullable: true }).isString(),
    body('is_required').optional().isBoolean(),
    body('phase_rubric_id')
      .optional({ nullable: true })
      .custom(value => value === null || Number.isInteger(Number(value)))
      .customSanitizer(value => (value === null ? null : Number(value))),
    body('max_files').optional().isInt({ min: 1 }).toInt(),
    body('max_file_size_mb').optional({ nullable: true }).isInt({ min: 1 }).toInt(),
    body('allowed_mime_types').optional().isArray(),
    body('allowed_mime_types.*').optional().isString()
  ],
  validateRequest,
  EventsController.createTask
);
eventsRouter.put(
  '/:eventId/tasks/:taskId',
  authorizeRoles('tenant_admin'),
  [
    param('eventId').isInt(),
    param('taskId').isInt(),
    body('title').optional().isString().notEmpty(),
    body('phase_id').optional().isInt(),
    body('delivery_type').optional().isIn(['text', 'file', 'url', 'video', 'audio', 'zip']),
    body('intro_html').optional({ nullable: true }).isString(),
    body('is_required').optional().isBoolean(),
    body('phase_rubric_id')
      .optional({ nullable: true })
      .custom(value => value === null || Number.isInteger(Number(value)))
      .customSanitizer(value => (value === null ? null : Number(value))),
    body('max_files').optional().isInt({ min: 1 }).toInt(),
    body('max_file_size_mb').optional({ nullable: true }).isInt({ min: 1 }).toInt(),
    body('allowed_mime_types').optional().isArray(),
    body('allowed_mime_types.*').optional().isString()
  ],
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

// Rutas de assets de eventos
eventsRouter.get(
  '/:eventId/assets',
  authorizeRoles('tenant_admin', 'organizer'),
  [param('eventId').isInt()],
  validateRequest,
  EventAssetsController.list
);

eventsRouter.post(
  '/:eventId/assets',
  authorizeRoles('tenant_admin'),
  [
    param('eventId').isInt(),
    body('name').isString().notEmpty().matches(/^[a-zA-Z0-9_-]+$/).withMessage('El nombre solo puede contener letras, números, guiones y guiones bajos')
  ],
  validateRequest,
  uploadMiddleware,
  EventAssetsController.upload
);

eventsRouter.delete(
  '/:eventId/assets/:assetId',
  authorizeRoles('tenant_admin'),
  [param('eventId').isInt(), param('assetId').isInt()],
  validateRequest,
  EventAssetsController.delete
);

