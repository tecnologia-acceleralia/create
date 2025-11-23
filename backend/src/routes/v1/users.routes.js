import { Router } from 'express';
import { body } from 'express-validator';
import { validateRequest } from '../../middleware/validation.middleware.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { AuthController } from '../../controllers/auth.controller.js';

export const usersRouter = Router();

usersRouter.use(authenticate);

usersRouter.patch(
  '/me',
  [
    body('first_name').optional().isString().trim().isLength({ min: 1, max: 150 }),
    body('last_name').optional().isString().trim().isLength({ min: 1, max: 150 }),
    body('email').optional().isEmail().normalizeEmail(),
    body('language').optional().isString().isIn(['es', 'en', 'ca']),
    body('profile_image').optional().isString(), // base64 image
    body('profile_image_url').optional({ nullable: true }).isString().trim().isLength({ max: 500 }),
    body('grade').optional().isString().trim().isLength({ max: 255 }).optional({ nullable: true })
  ],
  validateRequest,
  (req, res, next) => AuthController.updateProfile(req, res, next)
);

usersRouter.post(
  '/me/change-password',
  [
    body('currentPassword').isString().notEmpty().withMessage('La contraseña actual es requerida'),
    body('newPassword').isString().isLength({ min: 8 }).withMessage('La nueva contraseña debe tener al menos 8 caracteres')
  ],
  validateRequest,
  (req, res, next) => AuthController.changePassword(req, res, next)
);

