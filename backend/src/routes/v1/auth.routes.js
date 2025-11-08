import { Router } from 'express';
import { body } from 'express-validator';
import { validateRequest } from '../../middleware/validation.middleware.js';
import { AuthController } from '../../controllers/auth.controller.js';

export const authRouter = Router();

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

