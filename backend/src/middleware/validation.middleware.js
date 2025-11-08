import { validationResult } from 'express-validator';

export function validateRequest(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: 'Validación fallida',
      errors: errors.array()
    });
  }
  return next();
}

