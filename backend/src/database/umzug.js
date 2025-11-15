import SequelizeLib from 'sequelize';
import { Umzug, SequelizeStorage } from 'umzug';
import { connectDatabase, getSequelize } from './database.js';
import { logger } from '../utils/logger.js';

// Wrapper del logger para Umzug que maneja correctamente los objetos
const umzugLogger = {
  info: (message) => {
    // Umzug puede pasar objetos o strings, así que los convertimos apropiadamente
    if (typeof message === 'string') {
      logger.info(message);
    } else if (message && typeof message === 'object') {
      // Si es un objeto, intentar extraer información útil
      const messageStr = message.message || message.name || JSON.stringify(message);
      logger.info(`Umzug: ${messageStr}`, message);
    } else {
      logger.info(`Umzug: ${String(message)}`);
    }
  },
  warn: (message) => {
    if (typeof message === 'string') {
      logger.warn(message);
    } else if (message && typeof message === 'object') {
      const messageStr = message.message || message.name || JSON.stringify(message);
      logger.warn(`Umzug: ${messageStr}`, message);
    } else {
      logger.warn(`Umzug: ${String(message)}`);
    }
  },
  error: (message) => {
    if (typeof message === 'string') {
      logger.error(message);
    } else if (message instanceof Error) {
      logger.error('Umzug error', message);
    } else if (message && typeof message === 'object') {
      const messageStr = message.message || message.name || JSON.stringify(message);
      logger.error(`Umzug: ${messageStr}`, message);
    } else {
      logger.error(`Umzug: ${String(message)}`);
    }
  },
  debug: (message) => {
    if (typeof message === 'string') {
      logger.debug(message);
    } else if (message && typeof message === 'object') {
      const messageStr = message.message || message.name || JSON.stringify(message);
      logger.debug(`Umzug: ${messageStr}`, message);
    } else {
      logger.debug(`Umzug: ${String(message)}`);
    }
  }
};

async function buildUmzug(collection, glob) {
  await connectDatabase();
  const sequelize = getSequelize();

  return new Umzug({
    migrations: {
      glob,
      resolve: ({ name, path, context }) => ({
        name,
        up: async () => {
          const migration = await import(path);
          return migration.up(context, SequelizeLib);
        },
        down: async () => {
          const migration = await import(path);
          return migration.down(context, SequelizeLib);
        }
      })
    },
    context: sequelize.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize, modelName: collection }),
    logger: umzugLogger
  });
}

export async function getMigrator() {
  return buildUmzug('migrations', 'src/database/migrations/*.js');
}

export async function getSeeder(scope = 'master') {
  return buildUmzug(`seeders_${scope}`, `src/database/seeders/${scope}/*.js`);
}

export async function getMigrationStatus() {
  const migrator = await getMigrator();
  const executed = await migrator.executed();
  const pending = await migrator.pending();

  return {
    executed: executed.map(m => m.name),
    pending: pending.map(m => m.name)
  };
}

