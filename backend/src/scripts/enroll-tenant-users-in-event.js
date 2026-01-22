#!/usr/bin/env node
/**
 * Enrolla en un evento a todos los usuarios del tenant que aún no estén enrolados.
 * Útil para recuperar usuarios históricos que se registraron antes del fix de event_id
 * (ver docs/fix-registro-evento-event-id.md).
 *
 * Uso:
 *   node src/scripts/enroll-tenant-users-in-event.js --tenant-slug=uic [--event-id=1] [--dry-run]
 */

import '../config/env.js';
import { connectDatabase, getSequelize } from '../database/database.js';
import { getModels } from '../models/index.js';
import { logger } from '../utils/logger.js';

async function resolveEvent(Event, tenant, eventIdArg) {
  if (eventIdArg != null) {
    const event = await Event.findOne({
      where: { id: eventIdArg, tenant_id: tenant.id },
      attributes: ['id', 'tenant_id']
    });
    if (event) return event;
    console.error(`❌ Evento id=${eventIdArg} no encontrado o no pertenece al tenant ${tenant.slug}`);
    return null;
  }
  const event = await Event.findOne({
    where: { tenant_id: tenant.id },
    attributes: ['id', 'tenant_id'],
    order: [['id', 'ASC']]
  });
  if (event) return event;
  console.error(`❌ No hay eventos en el tenant ${tenant.slug}`);
  return null;
}

async function runDryRun(User, toEnrollIds) {
  const users = await User.findAll({
    where: { id: toEnrollIds },
    attributes: ['id', 'email', 'first_name', 'last_name'],
    raw: true
  });
  console.log('🔍 MODO DRY RUN - No se crean EventRegistration\n');
  console.log('Usuarios que se enrolarían:');
  users.forEach((u, i) => {
    console.log(`   ${i + 1}. ${u.first_name} ${u.last_name} (${u.email}) id=${u.id}`);
  });
  console.log('\n💡 Ejecuta sin --dry-run para crear las inscripciones.');
}

async function enrollTenantUsersInEvent(options = {}) {
  const { tenantSlug = 'uic', eventId: eventIdArg, dryRun = false } = options;

  try {
    await connectDatabase();
    const { Tenant, Event, UserTenant, User, EventRegistration } = getModels();
    const sequelize = getSequelize();

    console.log('🔍 Enrollando usuarios del tenant en el evento...\n');

    const tenant = await Tenant.findOne({
      where: { slug: tenantSlug },
      attributes: ['id', 'name', 'slug']
    });

    if (tenant) {
      console.log(`✅ Tenant: ${tenant.name} (${tenant.slug}), id=${tenant.id}\n`);
    } else {
      console.error(`❌ Tenant no encontrado: ${tenantSlug}`);
      process.exitCode = 1;
      return;
    }

    const event = await resolveEvent(Event, tenant, eventIdArg);
    if (!event) {
      process.exitCode = 1;
      return;
    }
    if (eventIdArg == null) {
      console.log(`   Usando primer evento del tenant: id=${event.id}\n`);
    }

    const memberships = await UserTenant.findAll({
      where: { tenant_id: tenant.id, status: 'active' },
      attributes: ['user_id'],
      raw: true
    });

    const tenantUserIds = [...new Set(memberships.map((m) => m.user_id))];

    if (tenantUserIds.length === 0) {
      console.log('⚠️  No hay usuarios activos en el tenant. Nada que hacer.');
      return;
    }

    const existing = await EventRegistration.findAll({
      where: { event_id: event.id, user_id: tenantUserIds },
      attributes: ['user_id'],
      raw: true
    });

    const alreadyEnrolledIds = new Set(existing.map((r) => r.user_id));
    const toEnrollIds = tenantUserIds.filter((id) => !alreadyEnrolledIds.has(id));

    console.log(`📊 Usuarios en tenant (activos): ${tenantUserIds.length}`);
    console.log(`   Ya enrolados en el evento: ${alreadyEnrolledIds.size}`);
    console.log(`   A enrolar: ${toEnrollIds.length}\n`);

    if (toEnrollIds.length === 0) {
      console.log('✅ Todos los usuarios del tenant ya están enrolados en el evento.');
      return;
    }

    if (dryRun) {
      await runDryRun(User, toEnrollIds);
      return;
    }

    const transaction = await sequelize.transaction();
    try {
      for (const userId of toEnrollIds) {
        await EventRegistration.create(
          {
            tenant_id: tenant.id,
            event_id: event.id,
            user_id: userId,
            status: 'registered'
          },
          { transaction }
        );
      }
      await transaction.commit();
      console.log(`✅ Creadas ${toEnrollIds.length} inscripción(es) en el evento (event_id=${event.id}).`);
      console.log('   Los usuarios aparecerán en Estadísticas → Tots els Usuaris.');
    } catch (err) {
      await transaction.rollback();
      logger.error('Error en enroll-tenant-users-in-event', { error: err.message, stack: err.stack });
      console.error('❌ Error creando inscripciones:', err.message);
      process.exitCode = 1;
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    logger.error('Error en enrollTenantUsersInEvent', { error: error.message, stack: error.stack });
    process.exitCode = 1;
  } finally {
    try {
      await getSequelize().close();
    } catch (closeError) {
      if (process.env.DEBUG === 'true') {
        console.error('Error cerrando Sequelize:', closeError);
      }
    }
    process.exit();
  }
}

const args = process.argv.slice(2);
const options = {};

args.forEach((arg) => {
  if (arg === '--dry-run' || arg === '-d') {
    options.dryRun = true;
  } else if (arg.startsWith('--tenant-slug=')) {
    options.tenantSlug = arg.split('=').slice(1).join('=').trim();
  } else if (arg.startsWith('--event-id=')) {
    const v = arg.split('=').slice(1).join('=').trim();
    const n = Number.parseInt(v, 10);
    if (Number.isNaN(n) || n < 1) {
      console.error('❌ --event-id debe ser un entero positivo');
      process.exit(1);
    }
    options.eventId = n;
  } else if (arg === '--help' || arg === '-h') {
    console.log(`
Uso: node src/scripts/enroll-tenant-users-in-event.js [opciones]

Enrolla en un evento a todos los usuarios activos del tenant que aún no tengan
EventRegistration para ese evento. Ver docs/fix-registro-evento-event-id.md.

Opciones:
  --tenant-slug=SLUG   Tenant (default: uic)
  --event-id=ID        Evento concreto. Si no se indica, se usa el primer evento del tenant.
  --dry-run, -d        Solo listar usuarios a enrolar, sin crear inscripciones.
  --help, -h           Esta ayuda.

Ejemplos (local, desde backend/):
  node src/scripts/enroll-tenant-users-in-event.js --tenant-slug=uic --dry-run
  node src/scripts/enroll-tenant-users-in-event.js --tenant-slug=uic --event-id=1

Dentro del contenedor Docker (desde la raíz del proyecto):
  docker compose exec backend node src/scripts/enroll-tenant-users-in-event.js --tenant-slug=uic --event-id=1 --dry-run
  docker compose exec backend node src/scripts/enroll-tenant-users-in-event.js --tenant-slug=uic --event-id=1
`);
    process.exit(0);
  }
});

enrollTenantUsersInEvent(options);
