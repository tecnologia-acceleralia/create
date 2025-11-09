import { Router } from 'express';
import { body, param } from 'express-validator';
import { RubricsController } from '../../controllers/rubrics.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { authorizeRoles } from '../../middleware/authorization.middleware.js';
import { validateRequest } from '../../middleware/validation.middleware.js';

export const rubricsRouter = Router({ mergeParams: true });

rubricsRouter.use(authenticate);

rubricsRouter.get(
  '/events/:eventId/phases/:phaseId/rubrics',
  [
    param('eventId').isInt(),
    param('phaseId').isInt()
  ],
  authorizeRoles('tenant_admin', 'organizer', 'evaluator'),
  validateRequest,
  RubricsController.listByPhase
);

const criteriaValidator = [
  body('criteria').isArray({ min: 1 }),
  body('criteria.*.title').isString().trim().notEmpty(),
  body('criteria.*.description').optional().isString(),
  body('criteria.*.weight').optional().isFloat({ min: 0 }),
  body('criteria.*.max_score').optional().isFloat({ min: 0 })
];

rubricsRouter.post(
  '/events/:eventId/phases/:phaseId/rubrics',
  [
    param('eventId').isInt(),
    param('phaseId').isInt(),
    body('name').isString().trim().notEmpty(),
    body('description').optional().isString(),
    body('scale_min').optional().isInt(),
    body('scale_max').optional().isInt(),
    body('model_preference').optional().isString(),
    ...criteriaValidator
  ],
  authorizeRoles('tenant_admin', 'organizer'),
  validateRequest,
  RubricsController.create
);

rubricsRouter.put(
  '/events/:eventId/phases/:phaseId/rubrics/:rubricId',
  [
    param('eventId').isInt(),
    param('phaseId').isInt(),
    param('rubricId').isInt(),
    body('name').optional().isString().trim().notEmpty(),
    body('description').optional().isString(),
    body('scale_min').optional().isInt(),
    body('scale_max').optional().isInt(),
    body('model_preference').optional().isString(),
    body('criteria').optional().isArray(),
    body('criteria.*.title').optional().isString().trim().notEmpty(),
    body('criteria.*.description').optional().isString(),
    body('criteria.*.weight').optional().isFloat({ min: 0 }),
    body('criteria.*.max_score').optional().isFloat({ min: 0 }),
    body('criteria.*.order_index').optional().isInt({ min: 1 })
  ],
  authorizeRoles('tenant_admin', 'organizer'),
  validateRequest,
  RubricsController.update
);

rubricsRouter.delete(
  '/events/:eventId/phases/:phaseId/rubrics/:rubricId',
  [
    param('eventId').isInt(),
    param('phaseId').isInt(),
    param('rubricId').isInt()
  ],
  authorizeRoles('tenant_admin', 'organizer'),
  validateRequest,
  RubricsController.delete
);


