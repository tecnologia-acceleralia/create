import { Sequelize } from 'sequelize';
import { appConfig } from '../config/env.js';
import { initModels } from '../models/index.js';
import { logger } from '../utils/logger.js';

let sequelizeInstance;

export const getSequelize = () => {
  if (!sequelizeInstance) {
    throw new Error('La conexión a la base de datos no está inicializada');
  }
  return sequelizeInstance;
};

export async function connectDatabase() {
  if (sequelizeInstance) {
    return sequelizeInstance;
  }

  const { db, databaseUrl } = appConfig;

  const commonOptions = {
    logging: msg => logger.debug?.(msg) ?? console.debug(msg),
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    define: {
      timestamps: true,
      underscored: true,
      freezeTableName: true
    }
  };

  sequelizeInstance = databaseUrl
    ? new Sequelize(databaseUrl, commonOptions)
    : new Sequelize(db.database, db.username, db.password, {
        host: db.host,
        port: db.port,
        dialect: db.dialect,
        ...commonOptions
      });

  initModels(sequelizeInstance);

  try {
    await sequelizeInstance.authenticate();
    logger.info('Conexión a base de datos establecida');

    if (appConfig.nodeEnv === 'development') {
      await sequelizeInstance.sync();
    }

    return sequelizeInstance;
  } catch (error) {
    logger.error('Error al conectar con la base de datos', error);
    throw error;
  }
}

