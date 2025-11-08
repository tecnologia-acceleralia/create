import { Router } from 'express';
import { body } from 'express-validator';
import { ensureSuperAdmin } from '../middleware/superadmin.middleware.js';
import { validateRequest } from '../middleware/validation.middleware.js';
import { SuperAdminController } from '../controllers/superadmin.controller.js';

export const superAdminRouter = Router();

superAdminRouter.use(ensureSuperAdmin);

superAdminRouter.post(
  '/tenants',
  [
    body('slug').isString().isLength({ min: 3 }).toLowerCase(),
    body('name').isString().notEmpty(),
    body('subdomain').optional().isString(),
    body('plan_type').optional().isIn(['free', 'basic', 'professional', 'enterprise'])
  ],
  validateRequest,
  (req, res, next) => SuperAdminController.createTenant(req, res, next)
);

superAdminRouter.get('/tenants', (req, res, next) => SuperAdminController.listTenants(req, res, next));

