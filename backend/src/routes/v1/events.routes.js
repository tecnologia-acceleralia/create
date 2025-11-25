import { Router } from 'express';
import { body, param } from 'express-validator';
import { EventsController } from '../../controllers/events.controller.js';
import { EventTrackingController } from '../../controllers/event-tracking.controller.js';
import { EventStatisticsController } from '../../controllers/event-statistics.controller.js';
import { EventDeliverablesController } from '../../controllers/event-deliverables.controller.js';
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
    // Aceptar name como string o objeto multiidioma
    body('name')
      .custom((value) => {
        if (typeof value === 'string') {
          return value.trim().length > 0;
        }
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          // Verificar que tenga al menos una propiedad con valor no vacío
          return Object.values(value).some(v => typeof v === 'string' && v.trim().length > 0);
        }
        return false;
      })
      .withMessage('El nombre es obligatorio'),
    body('description').optional(),
    // Aceptar fechas en formato ISO8601 (incluye YYYY-MM-DD de input type="date")
    body('start_date')
      .custom((value) => {
        if (!value) return false;
        // Aceptar formato ISO8601 completo o YYYY-MM-DD
        const iso8601Regex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})?)?$/;
        const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (typeof value === 'string' && (iso8601Regex.test(value) || dateOnlyRegex.test(value))) {
          const date = new Date(value);
          return !isNaN(date.getTime());
        }
        return false;
      })
      .withMessage('La fecha de inicio debe ser válida (formato ISO8601)'),
    body('end_date')
      .custom((value) => {
        if (!value) return false;
        // Aceptar formato ISO8601 completo o YYYY-MM-DD
        const iso8601Regex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})?)?$/;
        const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (typeof value === 'string' && (iso8601Regex.test(value) || dateOnlyRegex.test(value))) {
          const date = new Date(value);
          return !isNaN(date.getTime());
        }
        return false;
      })
      .withMessage('La fecha de fin debe ser válida (formato ISO8601)'),
    body('min_team_size').optional().isInt({ min: 1 }),
    body('max_team_size').optional().isInt({ min: 1 }),
    body('video_url').optional({ checkFalsy: true }).isURL().withMessage('URL de video inválida'),
    body('is_public').optional().isBoolean().toBoolean(),
    body('publish_start_at')
      .optional({ checkFalsy: true })
      .custom((value) => {
        if (!value) return true;
        const iso8601Regex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})?)?$/;
        const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (typeof value === 'string' && (iso8601Regex.test(value) || dateOnlyRegex.test(value))) {
          const date = new Date(value);
          return !isNaN(date.getTime());
        }
        return false;
      })
      .withMessage('La fecha de inicio de publicación debe ser válida (formato ISO8601)'),
    body('publish_end_at')
      .optional({ checkFalsy: true })
      .custom((value) => {
        if (!value) return true;
        const iso8601Regex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})?)?$/;
        const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (typeof value === 'string' && (iso8601Regex.test(value) || dateOnlyRegex.test(value))) {
          const date = new Date(value);
          return !isNaN(date.getTime());
        }
        return false;
      })
      .withMessage('La fecha de fin de publicación debe ser válida (formato ISO8601)'),
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

eventsRouter.post(
  '/:eventId/clone',
  authorizeRoles('tenant_admin'),
  [param('eventId').isInt()],
  validateRequest,
  EventsController.clone
);

eventsRouter.get(
  '/:eventId',
  authorizeRoles('tenant_admin', 'organizer', 'evaluator', 'participant', 'team_captain'),
  [
    param('eventId')
      .custom(value => {
        // Verificar que sea un número entero válido (no acepta "1:1" u otros formatos)
        const num = Number.parseInt(value, 10);
        if (Number.isNaN(num) || num.toString() !== String(value).trim()) {
          throw new Error('El ID del evento debe ser un número entero válido');
        }
        return true;
      })
      .toInt()
  ],
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

eventsRouter.get(
  '/:eventId/statistics',
  authorizeRoles('tenant_admin', 'organizer'),
  [param('eventId').isInt()],
  validateRequest,
  EventStatisticsController.getStatistics
);

eventsRouter.get(
  '/:eventId/deliverables-tracking',
  authorizeRoles('tenant_admin', 'organizer', 'evaluator'),
  [param('eventId').isInt()],
  validateRequest,
  EventDeliverablesController.getDeliverablesTracking
);

eventsRouter.put(
  '/:eventId',
  authorizeRoles('tenant_admin'),
  [
    param('eventId').isInt(),
    // name puede ser string o objeto multiidioma
    body('name')
      .optional()
      .custom(value => {
        if (value === undefined || value === null) return true;
        if (typeof value === 'string') {
          return value.trim().length > 0;
        }
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          // Objeto multiidioma: debe tener al menos una propiedad con valor no vacío
          return Object.values(value).some(v => typeof v === 'string' && v.trim().length > 0);
        }
        return false;
      })
      .withMessage('El nombre debe ser un string no vacío o un objeto multiidioma válido'),
    // description puede ser string, objeto multiidioma o null
    body('description')
      .optional({ nullable: true })
      .custom(value => {
        if (value === undefined || value === null || value === '') return true;
        if (typeof value === 'string') return true;
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          // Objeto multiidioma válido
          return true;
        }
        return false;
      })
      .withMessage('La descripción debe ser un string, un objeto multiidioma o null'),
    body('start_date')
      .optional()
      .custom((value) => {
        if (!value) return true;
        const iso8601Regex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})?)?$/;
        const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (typeof value === 'string' && (iso8601Regex.test(value) || dateOnlyRegex.test(value))) {
          const date = new Date(value);
          return !isNaN(date.getTime());
        }
        return false;
      })
      .withMessage('La fecha de inicio debe ser válida (formato ISO8601)'),
    body('end_date')
      .optional()
      .custom((value) => {
        if (!value) return true;
        const iso8601Regex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})?)?$/;
        const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (typeof value === 'string' && (iso8601Regex.test(value) || dateOnlyRegex.test(value))) {
          const date = new Date(value);
          return !isNaN(date.getTime());
        }
        return false;
      })
      .withMessage('La fecha de fin debe ser válida (formato ISO8601)'),
    body('min_team_size').optional().isInt({ min: 1 }),
    body('max_team_size').optional().isInt({ min: 1 }),
    body('video_url').optional({ checkFalsy: true }).isURL().withMessage('URL de video inválida'),
    body('is_public').optional().isBoolean().toBoolean(),
    body('publish_start_at')
      .optional({ checkFalsy: true })
      .custom((value) => {
        if (!value) return true;
        const iso8601Regex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})?)?$/;
        const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (typeof value === 'string' && (iso8601Regex.test(value) || dateOnlyRegex.test(value))) {
          const date = new Date(value);
          return !isNaN(date.getTime());
        }
        return false;
      })
      .withMessage('La fecha de inicio de publicación debe ser válida (formato ISO8601)'),
    body('publish_end_at')
      .optional({ checkFalsy: true })
      .custom((value) => {
        if (!value) return true;
        const iso8601Regex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})?)?$/;
        const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (typeof value === 'string' && (iso8601Regex.test(value) || dateOnlyRegex.test(value))) {
          const date = new Date(value);
          return !isNaN(date.getTime());
        }
        return false;
      })
      .withMessage('La fecha de fin de publicación debe ser válida (formato ISO8601)'),
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

// Rutas de exportación e importación de fases y tareas
eventsRouter.get(
  '/:eventId/phases/export',
  authorizeRoles('tenant_admin'),
  [param('eventId').isInt()],
  validateRequest,
  EventsController.exportPhasesAndTasks
);

eventsRouter.post(
  '/:eventId/phases/import',
  authorizeRoles('tenant_admin'),
  [
    param('eventId').isInt(),
    body('replace').optional().isBoolean().toBoolean(),
    body('phases').isArray().notEmpty().withMessage('Se requiere un array de fases'),
    body('phases.*.name').isString().notEmpty().withMessage('Cada fase debe tener un nombre'),
    body('phases.*.description').optional().isString(),
    body('phases.*.intro_html').optional().isString(),
    body('phases.*.start_date').optional({ nullable: true, checkFalsy: true }).isISO8601(),
    body('phases.*.end_date').optional({ nullable: true, checkFalsy: true }).isISO8601(),
    body('phases.*.view_start_date').optional({ nullable: true, checkFalsy: true }).isISO8601(),
    body('phases.*.view_end_date').optional({ nullable: true, checkFalsy: true }).isISO8601(),
    body('phases.*.order_index').optional().isInt({ min: 1 }),
    body('phases.*.is_elimination').optional().isBoolean(),
    body('phases.*.tasks').optional().isArray(),
    body('phases.*.tasks.*.title').optional().isString().notEmpty(),
    body('phases.*.tasks.*.description').optional().isString(),
    body('phases.*.tasks.*.intro_html').optional().isString(),
    body('phases.*.tasks.*.delivery_type').optional().isIn(['text', 'file', 'url', 'video', 'audio', 'zip', 'none']),
    body('phases.*.tasks.*.is_required').optional().isBoolean(),
    body('phases.*.tasks.*.due_date').optional({ nullable: true, checkFalsy: true }).isISO8601(),
    body('phases.*.tasks.*.status').optional().isIn(['draft', 'active', 'closed']),
    body('phases.*.tasks.*.order_index').optional().isInt({ min: 1 }),
    body('phases.*.tasks.*.max_files').optional().isInt({ min: 1 }),
    body('phases.*.tasks.*.max_file_size_mb').optional({ nullable: true }).isInt({ min: 1 }),
    body('phases.*.tasks.*.allowed_mime_types').optional().isArray(),
    body('phases.*.tasks.*.allowed_mime_types.*').optional().isString()
  ],
  validateRequest,
  EventsController.importPhasesAndTasks
);

eventsRouter.get('/:eventId/tasks', [param('eventId').isInt()], validateRequest, EventsController.listTasks);
eventsRouter.post(
  '/:eventId/tasks',
  authorizeRoles('tenant_admin'),
  [
    param('eventId').isInt(),
    body('title').isString().notEmpty(),
    body('phase_id').isInt(),
    body('delivery_type').optional().isIn(['text', 'file', 'url', 'video', 'audio', 'zip', 'none']),
    body('intro_html').optional({ nullable: true }).isString(),
    body('is_required').optional().isBoolean(),
    body('phase_rubric_id')
      .optional({ nullable: true, checkFalsy: true })
      .custom(value => {
        if (value === null || value === undefined || value === '') return true;
        const num = Number(value);
        return !Number.isNaN(num) && Number.isInteger(num);
      })
      .customSanitizer(value => {
        if (value === null || value === undefined || value === '') return null;
        const num = Number(value);
        return Number.isNaN(num) ? null : num;
      }),
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
    body('delivery_type').optional().isIn(['text', 'file', 'url', 'video', 'audio', 'zip', 'none']),
    body('intro_html').optional({ nullable: true }).isString(),
    body('is_required').optional().isBoolean(),
    body('phase_rubric_id')
      .optional({ nullable: true, checkFalsy: true })
      .custom(value => {
        if (value === null || value === undefined || value === '') return true;
        const num = Number(value);
        return !Number.isNaN(num) && Number.isInteger(num);
      })
      .customSanitizer(value => {
        if (value === null || value === undefined || value === '') return null;
        const num = Number(value);
        return Number.isNaN(num) ? null : num;
      }),
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
  [
    param('eventId')
      .customSanitizer(value => parseInt(value, 10))
      .isInt()
  ],
  validateRequest,
  EventAssetsController.list
);

eventsRouter.get(
  '/:eventId/assets/validate',
  authorizeRoles('tenant_admin'),
  [param('eventId').isInt()],
  validateRequest,
  EventAssetsController.validate
);

eventsRouter.get(
  '/:eventId/assets/check-markers',
  authorizeRoles('tenant_admin'),
  [param('eventId').isInt()],
  validateRequest,
  EventAssetsController.checkMarkers
);

eventsRouter.post(
  '/:eventId/assets',
  authorizeRoles('tenant_admin'),
  [
    param('eventId')
      .customSanitizer(value => parseInt(value, 10))
      .isInt(),
    body('name')
      .optional({ checkFalsy: true })
      .isString()
      .customSanitizer(value => {
        // Normalizar el nombre (eliminar acentos) antes de validar
        if (typeof value === 'string' && value.trim().length > 0) {
          return value
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();
        }
        return value;
      })
      .custom((value) => {
        // Si se proporciona un nombre, debe cumplir el formato
        if (value && typeof value === 'string' && value.trim().length > 0) {
          const nameRegex = /^[a-zA-Z0-9._-]+$/;
          if (!nameRegex.test(value.trim())) {
            throw new Error('El nombre solo puede contener letras, números, guiones, puntos y guiones bajos');
          }
        }
        return true;
      })
  ],
  uploadMiddleware, // Multer debe ejecutarse antes de validateRequest para parsear multipart/form-data
  validateRequest,
  EventAssetsController.upload
);

eventsRouter.put(
  '/:eventId/assets/:assetId',
  authorizeRoles('tenant_admin'),
  [
    param('eventId').isInt(),
    param('assetId').isInt(),
    body('name')
      .optional()
      .isString()
      .notEmpty()
      .customSanitizer(value => {
        // Normalizar el nombre (eliminar acentos) antes de validar
        if (typeof value === 'string') {
          return value
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();
        }
        return value;
      })
      .matches(/^[a-zA-Z0-9._-]+$/)
      .withMessage('El nombre solo puede contener letras, números, guiones, puntos y guiones bajos'),
    body('description').optional().isString()
  ],
  validateRequest,
  EventAssetsController.update
);

eventsRouter.delete(
  '/:eventId/assets/:assetId',
  authorizeRoles('tenant_admin'),
  [param('eventId').isInt(), param('assetId').isInt()],
  validateRequest,
  EventAssetsController.delete
);

