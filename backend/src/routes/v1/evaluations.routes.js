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
    body('locale').optional().isString(),
    body('status').optional().isIn(['draft', 'final'])
  ],
  validateRequest,
  EvaluationsController.createAi
);

evaluationsRouter.post(
  '/submissions/:submissionId/evaluations',
  authorizeRoles('tenant_admin', 'organizer', 'evaluator'),
  [
    param('submissionId').isInt(),
    body('score').optional().isFloat({ min: 0, max: 10 }),
    body('comment').optional().isString(),
    body('source').optional().isIn(['manual', 'ai_assisted']),
    body('status').optional().isIn(['draft', 'final']),
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

evaluationsRouter.get(
  '/submissions/:submissionId/evaluation/final',
  [param('submissionId').isInt()],
  validateRequest,
  EvaluationsController.getFinal
);

evaluationsRouter.put(
  '/submissions/:submissionId/evaluations/:evaluationId',
  authorizeRoles('tenant_admin', 'organizer', 'evaluator'),
  [
    param('submissionId').isInt(),
    param('evaluationId').isInt(),
    body('score').optional().isFloat({ min: 0, max: 10 }),
    body('comment').optional().isString(),
    body('status').optional().isIn(['draft', 'final']),
    body('rubric_snapshot').optional().isObject(),
    body('metadata').optional().isObject()
  ],
  validateRequest,
  EvaluationsController.update
);

// Rutas para evaluaciones de fase
evaluationsRouter.post(
  '/phases/:phaseId/teams/:teamId/evaluations',
  authorizeRoles('tenant_admin', 'organizer', 'evaluator'),
  [
    param('phaseId').isInt(),
    param('teamId').isInt(),
    body('submission_ids').isArray({ min: 1 }),
    body('submission_ids.*').isInt(),
    body('score').optional().isInt({ min: 0, max: 100 }),
    body('comment').isString().notEmpty(),
    body('source').optional().isIn(['manual', 'ai_assisted']),
    body('status').optional().isIn(['draft', 'final']),
    body('rubric_snapshot').optional().isObject(),
    body('metadata').optional().isObject()
  ],
  validateRequest,
  EvaluationsController.createPhaseEvaluation
);

evaluationsRouter.post(
  '/phases/:phaseId/teams/:teamId/evaluations/ai',
  authorizeRoles('tenant_admin', 'organizer', 'evaluator'),
  [
    param('phaseId').isInt(),
    param('teamId').isInt(),
    body('submission_ids').isArray({ min: 1 }),
    body('submission_ids.*').isInt(),
    body('locale').optional().isString(),
    body('status').optional().isIn(['draft', 'final'])
  ],
  validateRequest,
  EvaluationsController.createPhaseAiEvaluation
);

evaluationsRouter.get(
  '/phases/:phaseId/teams/:teamId/evaluations',
  [
    param('phaseId').isInt(),
    param('teamId').isInt()
  ],
  validateRequest,
  EvaluationsController.getPhaseEvaluations
);

// Rutas para evaluaciones de proyecto
evaluationsRouter.post(
  '/projects/:projectId/evaluations',
  authorizeRoles('tenant_admin', 'organizer', 'evaluator'),
  [
    param('projectId').isInt(),
    body('submission_ids').optional().isArray(),
    body('submission_ids.*').optional().isInt(),
    body('score').optional().isFloat({ min: 0, max: 10 }),
    body('comment').isString().notEmpty(),
    body('source').optional().isIn(['manual', 'ai_assisted']),
    body('status').optional().isIn(['draft', 'final']),
    body('rubric_snapshot').optional().isObject(),
    body('metadata').optional().isObject()
  ],
  validateRequest,
  EvaluationsController.createProjectEvaluation
);

evaluationsRouter.get(
  '/projects/:projectId/evaluations',
  [
    param('projectId').isInt()
  ],
  validateRequest,
  EvaluationsController.getProjectEvaluations
);

