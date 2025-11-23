import { Router } from 'express';
import { body } from 'express-validator';
import { TranslationController } from '../../controllers/translation.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { authorizeRoles } from '../../middleware/authorization.middleware.js';
import { validateRequest } from '../../middleware/validation.middleware.js';

export const translationRouter = Router();

translationRouter.use(authenticate);

translationRouter.post(
  '/translate',
  authorizeRoles('tenant_admin', 'organizer'),
  [
    body('text').isString().notEmpty().withMessage('El campo "text" es obligatorio'),
    body('targetLanguage')
      .isIn(['ca', 'en'])
      .withMessage('El campo "targetLanguage" debe ser "ca" o "en"'),
    body('isHtml').optional().isBoolean().withMessage('El campo "isHtml" debe ser un booleano')
  ],
  validateRequest,
  TranslationController.translate
);

