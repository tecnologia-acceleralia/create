import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { ensureSuperAdmin } from '../middleware/superadmin.middleware.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validateRequest } from '../middleware/validation.middleware.js';
import { SuperAdminController } from '../controllers/superadmin.controller.js';
import { AuthController } from '../controllers/auth.controller.js';

export const superAdminRouter = Router();

const TENANT_SORT_FIELDS = ['name', 'slug', 'plan', 'plan_type', 'status', 'created_at', 'updated_at'];
const USER_SORT_FIELDS = ['email', 'first_name', 'last_name', 'status', 'created_at', 'updated_at', 'last_login_at'];

function validateJsonable(value) {
  if (value === undefined || value === null || value === '') {
    return true;
  }
  if (typeof value === 'object') {
    return true;
  }
  if (typeof value === 'string') {
    try {
      JSON.parse(value);
      return true;
    } catch (error) {
      throw new Error('Debe ser un JSON válido');
    }
  }
  throw new Error('Formato inválido');
}

superAdminRouter.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isString().isLength({ min: 6 })
  ],
  validateRequest,
  (req, res, next) => AuthController.superAdminLogin(req, res, next)
);

superAdminRouter.use(authenticate, ensureSuperAdmin);

superAdminRouter.get('/overview', (req, res, next) => SuperAdminController.overview(req, res, next));

superAdminRouter.post(
  '/tenants',
  [
    body('slug').isString().isLength({ min: 3 }).toLowerCase(),
    body('name').isString().notEmpty().trim(),
    body('subdomain').optional({ nullable: true }).isString().isLength({ min: 3 }).toLowerCase(),
    body('custom_domain').optional({ nullable: true }).isString().trim(),
    body('plan_type').optional({ nullable: true }).isIn(['free', 'basic', 'professional', 'enterprise']),
    body('status').optional({ nullable: true }).isIn(['active', 'suspended', 'trial', 'cancelled']),
    body('primary_color').optional({ nullable: true }).isHexColor(),
    body('secondary_color').optional({ nullable: true }).isHexColor(),
    body('accent_color').optional({ nullable: true }).isHexColor(),
    body('logo_url').optional({ nullable: true }).isString(),
    body('start_date').optional({ nullable: true }).isISO8601({ strict: true }),
    body('end_date').optional({ nullable: true }).isISO8601({ strict: true }),
    body('website_url').optional({ nullable: true }).isURL(),
    body('facebook_url').optional({ nullable: true }).isURL(),
    body('instagram_url').optional({ nullable: true }).isURL(),
    body('linkedin_url').optional({ nullable: true }).isURL(),
    body('twitter_url').optional({ nullable: true }).isURL(),
    body('youtube_url').optional({ nullable: true }).isURL(),
    body('max_evaluators').optional({ nullable: true }).isInt({ min: 0 }),
    body('max_participants').optional({ nullable: true }).isInt({ min: 0 }),
    body('max_appointments_per_month').optional({ nullable: true }).isInt({ min: 0 }),
    body('hero_content').optional({ nullable: true }).custom(validateJsonable),
    body('tenant_css').optional({ nullable: true }).isString(),
    body('registration_schema').optional({ nullable: true }).custom(validateJsonable),
    body('admin.email').isEmail().normalizeEmail(),
    body('admin.first_name').optional({ nullable: true }).isString(),
    body('admin.last_name').optional({ nullable: true }).isString(),
    body('admin.password').optional({ nullable: true }).isLength({ min: 6 }),
    body('admin.language').optional({ nullable: true }).isString().isLength({ min: 2, max: 10 }),
    body('admin.profile_image_url').optional({ nullable: true }).isURL()
  ],
  validateRequest,
  (req, res, next) => SuperAdminController.createTenant(req, res, next)
);

superAdminRouter.get(
  '/tenants',
  [
    query('page').optional().isInt({ min: 1 }),
    query('pageSize').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isString(),
    query('plan').optional().isString(),
    query('search').optional().isString(),
    query('sortField').optional().isIn(TENANT_SORT_FIELDS),
    query('sortOrder').optional().isIn(['asc', 'desc'])
  ],
  validateRequest,
  (req, res, next) => SuperAdminController.listTenants(req, res, next)
);

superAdminRouter.patch(
  '/tenants/:tenantId',
  [
    param('tenantId').isInt({ gt: 0 }),
    body('name').optional({ nullable: true }).isString().notEmpty(),
    body('plan_type').optional({ nullable: true }).isIn(['free', 'basic', 'professional', 'enterprise']),
    body('status').optional({ nullable: true }).isIn(['active', 'suspended', 'trial', 'cancelled']),
    body('primary_color').optional({ nullable: true }).isHexColor(),
    body('secondary_color').optional({ nullable: true }).isHexColor(),
    body('accent_color').optional({ nullable: true }).isHexColor(),
    body('custom_domain').optional({ nullable: true }).isString().trim(),
    body('subdomain').optional({ nullable: true }).isString().isLength({ min: 3 }).toLowerCase(),
    body('logo').optional({ nullable: true }).isString(),
    body('logo_url').optional({ nullable: true }).isString(),
    body('website_url').optional({ nullable: true }).isURL(),
    body('facebook_url').optional({ nullable: true }).isURL(),
    body('instagram_url').optional({ nullable: true }).isURL(),
    body('linkedin_url').optional({ nullable: true }).isURL(),
    body('twitter_url').optional({ nullable: true }).isURL(),
    body('youtube_url').optional({ nullable: true }).isURL(),
    body('max_evaluators').optional({ nullable: true }).isInt({ min: 0 }),
    body('max_participants').optional({ nullable: true }).isInt({ min: 0 }),
    body('max_appointments_per_month').optional({ nullable: true }).isInt({ min: 0 }),
    body('hero_content').optional({ nullable: true }).custom(validateJsonable),
    body('tenant_css').optional({ nullable: true }).isString(),
    body('start_date').optional({ nullable: true }).isISO8601({ strict: true }),
    body('end_date').optional({ nullable: true }).isISO8601({ strict: true }),
    body('registration_schema').optional({ nullable: true }).custom(validateJsonable)
  ],
  validateRequest,
  (req, res, next) => SuperAdminController.updateTenant(req, res, next)
);

superAdminRouter.delete(
  '/tenants/:tenantId',
  [param('tenantId').isInt({ gt: 0 })],
  validateRequest,
  (req, res, next) => SuperAdminController.deleteTenant(req, res, next)
);

superAdminRouter.get(
  '/users',
  [
    query('page').optional().isInt({ min: 1 }),
    query('pageSize').optional().isInt({ min: 1, max: 100 }),
    query('tenantId').optional().isInt({ gt: 0 }),
    query('status').optional().isString(),
    query('isSuperAdmin').optional().isIn(['true', 'false']),
    query('search').optional().isString(),
    query('lastLoginFilter').optional().isIn(['never', 'last7days', 'last30days', 'last90days']),
    query('sortField').optional().isIn(USER_SORT_FIELDS),
    query('sortOrder').optional().isIn(['asc', 'desc'])
  ],
  validateRequest,
  (req, res, next) => SuperAdminController.listUsers(req, res, next)
);

superAdminRouter.post(
  '/users',
  [
    body('email').isEmail().normalizeEmail(),
    body('first_name').isString().notEmpty().trim(),
    body('last_name').isString().notEmpty().trim(),
    body('language').optional({ nullable: true }).isString().isLength({ min: 2, max: 10 }),
    body('status').optional({ nullable: true }).isIn(['active', 'inactive', 'invited']),
    body('is_super_admin').optional().isBoolean().toBoolean(),
    body('password').optional({ nullable: true }).isLength({ min: 6 }),
    body('profile_image_url').optional({ nullable: true }).isURL(),
    body('grade').optional({ nullable: true }).isString().trim().isLength({ min: 1, max: 255 }),
    body('registration_answers').optional({ nullable: true }).isObject(),
    body('tenantIds').optional({ nullable: true }).isArray(),
    body('tenantIds.*').optional({ nullable: true }).isInt({ gt: 0 })
  ],
  validateRequest,
  (req, res, next) => SuperAdminController.createUser(req, res, next)
);

superAdminRouter.patch(
  '/users/:userId',
  [
    param('userId').isInt({ gt: 0 }),
    body('email').optional({ nullable: true }).isEmail().normalizeEmail(),
    body('first_name').optional({ nullable: true }).isString().trim(),
    body('last_name').optional({ nullable: true }).isString().trim(),
    body('language').optional({ nullable: true }).isString().isLength({ min: 2, max: 10 }),
    body('status').optional({ nullable: true }).isIn(['active', 'inactive', 'invited']),
    body('is_super_admin').optional().isBoolean().toBoolean(),
    body('password').optional({ nullable: true }).isLength({ min: 6 }),
    body('profile_image_url').optional({ nullable: true }).isURL(),
    body('grade').optional({ nullable: true }).isString().trim().isLength({ min: 1, max: 255 }),
    body('registration_answers').optional({ nullable: true }).isObject(),
    body('tenantIds').optional({ nullable: true }).isArray(),
    body('tenantIds.*').optional({ nullable: true }).isInt({ gt: 0 })
  ],
  validateRequest,
  (req, res, next) => SuperAdminController.updateUser(req, res, next)
);

superAdminRouter.delete(
  '/users/:userId',
  [param('userId').isInt({ gt: 0 })],
  validateRequest,
  (req, res, next) => SuperAdminController.deleteUser(req, res, next)
);

superAdminRouter.get('/healthcheck', (req, res, next) => SuperAdminController.healthcheck(req, res, next));
superAdminRouter.post(
  '/healthcheck/:service/test',
  [param('service').isIn(['mailersend', 'openai', 'spaces'])],
  validateRequest,
  (req, res, next) => SuperAdminController.healthcheckServiceTest(req, res, next)
);

superAdminRouter.delete(
  '/events/:eventId/clean',
  [param('eventId').isInt({ gt: 0 })],
  validateRequest,
  (req, res, next) => SuperAdminController.cleanEvent(req, res, next)
);

