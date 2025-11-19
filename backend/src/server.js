import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { json, urlencoded } from 'express';
import { tenantMiddleware } from './middleware/tenant.middleware.js';
import { tenantContextMiddleware } from './middleware/tenant-context.middleware.js';
import { router } from './routes/index.js';
import { superAdminRouter } from './routes/superadmin.routes.js';
import { publicRouter } from './routes/public.routes.js';
import { errorHandler } from './middleware/error.middleware.js';

export async function createServer() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') ?? '*' }));
  app.use(morgan('combined'));
  // Aumentar límite para permitir archivos en base64 (50MB)
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  app.get('/health', (req, res) => {
    res.json({ success: true, message: 'ok' });
  });

  app.use('/api/public', publicRouter);
  app.use('/api/superadmin', superAdminRouter);
  app.use('/api', tenantMiddleware, tenantContextMiddleware, router);

  app.use(errorHandler);

  return app;
}

