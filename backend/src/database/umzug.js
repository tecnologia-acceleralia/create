import SequelizeLib from 'sequelize';
import { Umzug, SequelizeStorage } from 'umzug';
import { connectDatabase, getSequelize } from './database.js';
import { logger } from '../utils/logger.js';

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
    logger
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

