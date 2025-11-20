import { Router } from 'express';
import { body } from 'express-validator';
import { validateRequest } from '../../middleware/validation.middleware.js';
import { AuthController } from '../../controllers/auth.controller.js';
import { PasswordResetController } from '../../controllers/password-reset.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

export const authRouter = Router();

authRouter.post(
  '/register',
  [
    body('first_name').isString().trim().isLength({ min: 1, max: 150 }),
    body('last_name').isString().trim().isLength({ min: 1, max: 150 }),
    body('email').isEmail().normalizeEmail(),
    body('password').isString().isLength({ min: 8 }),
    body('language').optional().isString().isIn(['es', 'en', 'ca']),
    body('event_id').optional().isInt({ min: 1 }),
    body('grade').optional().isString().trim().isLength({ min: 1, max: 255 }),
    body('registration_answers').optional().isObject()
  ],
  validateRequest,
  (req, res, next) => AuthController.register(req, res, next)
);

authRouter.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isString().isLength({ min: 6 })
  ],
  validateRequest,
  (req, res, next) => AuthController.login(req, res, next)
);

authRouter.post(
  '/refresh',
  [body('refreshToken').isString().notEmpty()],
  validateRequest,
  (req, res, next) => AuthController.refreshToken(req, res, next)
);

authRouter.post(
  '/password-reset/request',
  [body('email').isEmail().normalizeEmail()],
  validateRequest,
  (req, res, next) => PasswordResetController.requestCode(req, res, next)
);

authRouter.post(
  '/password-reset/verify',
  [
    body('email').isEmail().normalizeEmail(),
    body('code').isString().trim().matches(/^\d{6}$/)
  ],
  validateRequest,
  (req, res, next) => PasswordResetController.verifyCode(req, res, next)
);

authRouter.post(
  '/password-reset/confirm',
  [
    body('email').isEmail().normalizeEmail(),
    body('code').isString().trim().matches(/^\d{6}$/),
    body('password').isString().isLength({ min: 6 })
  ],
  validateRequest,
  (req, res, next) => PasswordResetController.confirmReset(req, res, next)
);

// Endpoint para que superadmin asegure membresía en un tenant
authRouter.post(
  '/ensure-membership',
  authenticate,
  (req, res, next) => AuthController.ensureSuperAdminMembership(req, res, next)
);

