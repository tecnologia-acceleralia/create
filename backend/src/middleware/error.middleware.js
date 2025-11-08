import { logger } from '../utils/logger.js';

export function errorHandler(err, req, res, next) {
  logger.error('Error no controlado', {
    message: err.message,
    stack: err.stack,
    path: req.originalUrl
  });

  if (res.headersSent) {
    return next(err);
  }

  const status = err.statusCode ?? 500;
  res.status(status).json({
    success: false,
    message: err.message ?? 'Error interno del servidor'
  });
}

