#!/usr/bin/env node
import 'dotenv/config';
import { getMigrator, getSeeder, getMigrationStatus } from '../database/umzug.js';
import { logger } from '../utils/logger.js';
import { connectDatabase, getSequelize } from '../database/database.js';

const args = process.argv.slice(2);
const command = args[0];
const flags = args.slice(1);

const getFlagValue = (name) => {
  const flag = flags.find((item) => item.startsWith(`${name}=`));
  return flag ? flag.split('=').slice(1).join('=') : undefined;
};

const parseIntegerFlag = (name) => {
  const value = getFlagValue(name);
  if (value === undefined) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`El flag ${name} debe ser un número entero`);
  }
  return parsed;
};

const printUsage = () => {
  console.log('Comandos disponibles:');
  console.log('  migrate:up                Ejecuta todas las migraciones pendientes');
  console.log('  migrate:down [--to=nombre | --step=n] Revierte migraciones');
  console.log('  migrate:status            Muestra migraciones ejecutadas y pendientes');
  console.log('  seed:master               Ejecuta los seeders de master data');
  console.log('  seed:test                 Ejecuta los seeders de datos de prueba');
  console.log('  seed:status [--json]      Muestra el estado de los seeders master y test');
  console.log('  seed:reset:test           Revierte los seeders de datos de prueba');
  console.log('  db:reset                  Revierte todo y vuelve a ejecutar migraciones + seeders');
};

const collectSeederStatus = async (scope, seeder) => {
  const [executed, pending] = await Promise.all([
    seeder.executed(),
    seeder.pending()
  ]);

  return {
    scope,
    executed: executed.map((item) => item.name),
    pending: pending.map((item) => item.name)
  };
};

async function run() {
  try {
    await connectDatabase();

    const migrator = await getMigrator();
    const masterSeeder = await getSeeder('master');
    const testSeeder = await getSeeder('test');

    switch (command) {
      case 'migrate:up':
        await migrator.up();
        logger.info('Migraciones aplicadas');
        break;
      case 'migrate:down': {
        const step = parseIntegerFlag('--step');
        const to = getFlagValue('--to');
        await migrator.down(step ? { step } : to ? { to } : undefined);
        logger.info('Migraciones revertidas');
        break;
      }
      case 'migrate:status': {
        const { executed, pending } = await getMigrationStatus();
        console.log('Migraciones ejecutadas:');
        executed.forEach(name => console.log(`  ✔ ${name}`));
        console.log('');
        console.log('Migraciones pendientes:');
        pending.forEach(name => console.log(`  ✖ ${name}`));
        break;
      }
      case 'seed:master':
        await masterSeeder.up();
        logger.info('Seeders master aplicados');
        break;
      case 'seed:test':
        await testSeeder.up();
        logger.info('Seeders test aplicados');
        break;
      case 'seed:status': {
        const status = await Promise.all([
          collectSeederStatus('master', masterSeeder),
          collectSeederStatus('test', testSeeder)
        ]);
        if (flags.includes('--json')) {
          console.log(JSON.stringify(status));
        } else {
          status.forEach(({ scope, executed, pending }) => {
            console.log(`Seeders ${scope}:`);
            console.log(`  Ejecutados (${executed.length})`);
            executed.forEach((name) => console.log(`    ✔ ${name}`));
            console.log(`  Pendientes (${pending.length})`);
            pending.forEach((name) => console.log(`    ✖ ${name}`));
            console.log('');
          });
        }
        break;
      }
      case 'seed:reset:test':
        await testSeeder.down({ step: Infinity });
        logger.info('Seeders test revertidos');
        break;
      case 'db:reset':
        await testSeeder.down({ step: Infinity }).catch(() => {});
        await masterSeeder.down({ step: Infinity }).catch(() => {});
        await migrator.down({ step: Infinity });
        await migrator.up();
        await masterSeeder.up();
        await testSeeder.up();
        logger.info('Base de datos reiniciada');
        break;
      default:
        printUsage();
        process.exitCode = 1;
    }
  } catch (error) {
    logger.error('Error ejecutando comando de base de datos', error);
    process.exitCode = 1;
  } finally {
    try {
      const sequelize = getSequelize();
      await sequelize.close();
    } catch (closeError) {
      if (process.env.DEBUG === 'true') {
        console.error('Error cerrando la conexión de Sequelize:', closeError);
      }
    }
    process.exit();
  }
}

run();
