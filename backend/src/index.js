import './config/env.js';
import { createServer } from './server.js';
import { logger } from './utils/logger.js';
import { connectDatabase } from './database/database.js';

const port = process.env.PORT || 4000;

async function bootstrap() {
  try {
    await connectDatabase();
    const app = await createServer();
    app.listen(port, () => {
      logger.info('Backend iniciado', { port, env: process.env.NODE_ENV });
    });
  } catch (error) {
    logger.error('Error al iniciar el backend', error);
    process.exit(1);
  }
}

bootstrap();

