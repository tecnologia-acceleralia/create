#!/usr/bin/env node
import '../config/env.js';
import { connectDatabase, getSequelize } from '../database/database.js';
import { getModels } from '../models/index.js';
import { ensureTeamCaptainRole } from '../utils/role-management.js';
import { logger } from '../utils/logger.js';
import { Op } from 'sequelize';

async function assignTeamCaptainRole(options = {}) {
  const { 
    userEmail,
    tenantSlug,
    dryRun = false 
  } = options;

  try {
    await connectDatabase();
    const { User, Team, TeamMember, Tenant } = getModels();
    const sequelize = getSequelize();

    console.log('🔍 Buscando usuario y equipos...\n');

    // Buscar usuario por email
    const user = await User.findOne({
      where: { email: userEmail },
      attributes: ['id', 'email', 'first_name', 'last_name']
    });

    if (!user) {
      console.error(`❌ Usuario no encontrado: ${userEmail}`);
      process.exitCode = 1;
      return;
    }

    console.log(`✅ Usuario encontrado: ${user.first_name} ${user.last_name} (${user.email})`);
    console.log(`   ID: ${user.id}\n`);

    // Buscar tenant si se especificó
    let tenant = null;
    if (tenantSlug) {
      tenant = await Tenant.findOne({
        where: { slug: tenantSlug },
        attributes: ['id', 'name', 'slug']
      });

      if (!tenant) {
        console.error(`❌ Tenant no encontrado: ${tenantSlug}`);
        process.exitCode = 1;
        return;
      }

      console.log(`✅ Tenant encontrado: ${tenant.name} (${tenant.slug})`);
      console.log(`   ID: ${tenant.id}\n`);
    }

    // Buscar equipos donde el usuario es capitán
    const whereConditions = {
      captain_id: user.id
    };

    if (tenant) {
      whereConditions.tenant_id = tenant.id;
    }

    const teams = await Team.findAll({
      where: whereConditions,
      attributes: ['id', 'name', 'tenant_id', 'event_id', 'captain_id'],
      include: [
        {
          model: Tenant,
          as: 'tenant',
          attributes: ['id', 'name', 'slug']
        }
      ]
    });

    if (teams.length === 0) {
      console.log('⚠️  No se encontraron equipos donde el usuario sea capitán');
      return;
    }

    console.log(`✅ Se encontraron ${teams.length} equipo(s) donde el usuario es capitán:\n`);

    // Agrupar por tenant
    const teamsByTenant = {};
    teams.forEach(team => {
      const tenantId = team.tenant_id;
      if (!teamsByTenant[tenantId]) {
        teamsByTenant[tenantId] = {
          tenant: team.tenant,
          teams: []
        };
      }
      teamsByTenant[tenantId].teams.push(team);
    });

    if (dryRun) {
      console.log('🔍 MODO DRY RUN - No se asignará ningún rol\n');
      Object.entries(teamsByTenant).forEach(([tenantId, data]) => {
        console.log(`📦 Tenant: ${data.tenant.name} (${data.tenant.slug})`);
        data.teams.forEach((team, index) => {
          console.log(`   ${index + 1}. Equipo: ${team.name} (ID: ${team.id}, Event ID: ${team.event_id})`);
        });
        console.log('');
      });
      console.log('💡 Ejecuta sin --dry-run para asignar los roles realmente');
      return;
    }

    // Asignar roles
    let totalAssigned = 0;
    let totalSkipped = 0;
    let errors = 0;

    for (const [tenantId, data] of Object.entries(teamsByTenant)) {
      const tenantIdNum = parseInt(tenantId, 10);
      console.log(`\n📦 Procesando tenant: ${data.tenant.name} (${data.tenant.slug})`);
      console.log(`   Equipos: ${data.teams.length}\n`);

      const transaction = await sequelize.transaction();

      try {
        // Asignar el rol team_captain para este tenant
        const assigned = await ensureTeamCaptainRole(user.id, tenantIdNum, { transaction });

        if (assigned) {
          totalAssigned++;
          console.log(`   ✅ Rol team_captain asignado en tenant ${data.tenant.name}`);
        } else {
          totalSkipped++;
          console.log(`   ⏭️  El usuario ya tiene el rol team_captain en tenant ${data.tenant.name}`);
        }

        await transaction.commit();
      } catch (error) {
        await transaction.rollback();
        errors++;
        console.error(`   ❌ Error asignando rol en tenant ${data.tenant.name}:`, error.message);
        logger.error('Error asignando rol team_captain', { 
          error: error.message, 
          stack: error.stack,
          userId: user.id,
          tenantId: tenantIdNum
        });
      }
    }

    // Resumen final
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN');
    console.log('='.repeat(60));
    console.log(`✅ Roles asignados: ${totalAssigned}`);
    console.log(`⏭️  Roles ya existentes (omitidos): ${totalSkipped}`);
    if (errors > 0) {
      console.log(`❌ Errores: ${errors}`);
    }
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('❌ Error en el proceso:', error.message);
    logger.error('Error en assignTeamCaptainRole', { error: error.message, stack: error.stack });
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

// Procesar argumentos de línea de comandos
const args = process.argv.slice(2);
const options = {};

// Parsear argumentos
args.forEach(arg => {
  if (arg === '--dry-run' || arg === '-d') {
    options.dryRun = true;
  } else if (arg.startsWith('--email=')) {
    options.userEmail = arg.split('=')[1];
  } else if (arg.startsWith('--tenant-slug=')) {
    options.tenantSlug = arg.split('=')[1];
  } else if (arg === '--help' || arg === '-h') {
    console.log(`
Uso: node assign-team-captain-role.js [opciones]

Opciones:
  --email=EMAIL              Email del usuario (requerido)
  --tenant-slug=SLUG         Filtrar por tenant slug específico (opcional)
  --dry-run, -d              Modo de prueba (no asigna roles, solo muestra lo que se haría)
  --help, -h                 Mostrar esta ayuda

Ejemplos:
  # Ver qué se haría (sin asignar)
  node assign-team-captain-role.js --email=carla.lema+adde@acceleralia.com --dry-run

  # Asignar rol team_captain a un usuario
  node assign-team-captain-role.js --email=carla.lema+adde@acceleralia.com

  # Asignar rol solo en un tenant específico
  node assign-team-captain-role.js --email=carla.lema+adde@acceleralia.com --tenant-slug=uic
`);
    process.exit(0);
  }
});

// Validar que se proporcionó el email
if (!options.userEmail) {
  console.error('❌ Error: Se requiere el parámetro --email');
  console.log('💡 Usa --help para ver la ayuda');
  process.exitCode = 1;
  process.exit();
}

assignTeamCaptainRole(options);
