#!/usr/bin/env node
import '../config/env.js';
import { Op } from 'sequelize';
import { connectDatabase, getSequelize } from '../database/database.js';
import { getModels } from '../models/index.js';
import { deleteObjectByKey } from '../services/tenant-assets.service.js';
import { logger } from '../utils/logger.js';

async function deleteAllSubmissions(options = {}) {
  const { 
    tenantId, 
    eventId, 
    teamId,
    dryRun = false 
  } = options;

  try {
    await connectDatabase();
    const { Submission, SubmissionFile, Evaluation } = getModels();
    const sequelize = getSequelize();

    console.log('🔍 Buscando submissions...\n');

    // Construir condiciones de búsqueda
    const whereConditions = {};
    if (tenantId) {
      whereConditions.tenant_id = tenantId;
      console.log(`   Filtro: Tenant ID = ${tenantId}`);
    }
    if (eventId) {
      whereConditions.event_id = eventId;
      console.log(`   Filtro: Event ID = ${eventId}`);
    }
    if (teamId) {
      whereConditions.team_id = teamId;
      console.log(`   Filtro: Team ID = ${teamId}`);
    }

    // Buscar todas las submissions que coincidan con los filtros
    const submissions = await Submission.findAll({
      where: whereConditions,
      include: [
        {
          model: SubmissionFile,
          as: 'files',
          attributes: ['id', 'storage_key', 'original_name', 'url']
        }
      ],
      attributes: ['id', 'tenant_id', 'event_id', 'task_id', 'team_id', 'submitted_by', 'status', 'type', 'submitted_at', 'created_at']
    });

    if (submissions.length === 0) {
      console.log('✅ No se encontraron submissions para eliminar');
      return;
    }

    console.log(`\n✅ Se encontraron ${submissions.length} submission(s) para eliminar\n`);

    if (dryRun) {
      console.log('🔍 MODO DRY RUN - No se eliminará nada\n');
      submissions.forEach((sub, index) => {
        const fileCount = sub.files ? sub.files.length : 0;
        console.log(`   ${index + 1}. Submission ID: ${sub.id}`);
        console.log(`      - Tenant ID: ${sub.tenant_id}`);
        console.log(`      - Event ID: ${sub.event_id}`);
        console.log(`      - Team ID: ${sub.team_id}`);
        console.log(`      - Task ID: ${sub.task_id}`);
        console.log(`      - Status: ${sub.status}`);
        console.log(`      - Type: ${sub.type}`);
        console.log(`      - Archivos: ${fileCount}`);
        console.log(`      - Fecha: ${sub.submitted_at || sub.created_at}`);
        console.log('');
      });
      console.log('💡 Ejecuta sin --dry-run para eliminar realmente');
      return;
    }

    // Agrupar por tenant_id para hacer la eliminación más eficiente
    const submissionsByTenant = {};
    submissions.forEach(sub => {
      const tenantId = sub.tenant_id;
      if (!submissionsByTenant[tenantId]) {
        submissionsByTenant[tenantId] = [];
      }
      submissionsByTenant[tenantId].push(sub);
    });

    let totalDeleted = 0;
    let totalFilesDeleted = 0;
    let totalEvaluationsDeleted = 0;
    let errors = 0;

    // Procesar por tenant
    for (const [tenantIdKey, tenantSubmissions] of Object.entries(submissionsByTenant)) {
      console.log(`\n📦 Procesando ${tenantSubmissions.length} submission(s) del tenant ${tenantIdKey}...`);

      // Procesar en lotes para evitar transacciones muy grandes
      const batchSize = 50;
      for (let i = 0; i < tenantSubmissions.length; i += batchSize) {
        const batch = tenantSubmissions.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(tenantSubmissions.length / batchSize);
        
        console.log(`\n   📦 Procesando lote ${batchNumber}/${totalBatches} (${batch.length} submission(s))...`);

        const transaction = await sequelize.transaction();

        try {
          const submissionIds = batch.map(sub => sub.id);
          const allFiles = batch.flatMap(sub => sub.files || []);

          // 1. Eliminar evaluaciones relacionadas
          const evaluationsDeleted = await Evaluation.destroy({
            where: { 
              submission_id: { [Op.in]: submissionIds },
              tenant_id: tenantIdKey
            },
            skipTenant: true,
            transaction
          });
          totalEvaluationsDeleted += evaluationsDeleted;
          if (evaluationsDeleted > 0) {
            console.log(`      ✅ Eliminadas ${evaluationsDeleted} evaluación(es)`);
          }

          // 2. Eliminar archivos de S3 y luego de BD
          if (allFiles.length > 0) {
            console.log(`      🗑️  Eliminando ${allFiles.length} archivo(s) de S3...`);
            
            // Eliminar archivos de S3 en paralelo
            const deleteResults = await Promise.allSettled(
              allFiles.map(file => {
                if (file.storage_key) {
                  return deleteObjectByKey(file.storage_key).catch(error => {
                    logger.warn('Error al borrar archivo de entrega de S3', {
                      error: error.message,
                      storageKey: file.storage_key,
                      submissionFileId: file.id
                    });
                    // No lanzar error, continuar con la eliminación
                    return null;
                  });
                }
                return Promise.resolve(null);
              })
            );

            const s3Deleted = deleteResults.filter(r => r.status === 'fulfilled').length;
            const s3Errors = deleteResults.filter(r => r.status === 'rejected').length;
            
            if (s3Deleted > 0) {
              console.log(`      ✅ ${s3Deleted} archivo(s) eliminado(s) de S3`);
            }
            if (s3Errors > 0) {
              console.log(`      ⚠️  ${s3Errors} error(es) al eliminar archivos de S3 (continuando...)`);
            }

            // Luego borrar registros de BD
            const filesDeleted = await SubmissionFile.destroy({
              where: { 
                submission_id: { [Op.in]: submissionIds },
                tenant_id: tenantIdKey
              },
              skipTenant: true,
              transaction
            });
            totalFilesDeleted += filesDeleted;
            if (filesDeleted > 0) {
              console.log(`      ✅ ${filesDeleted} archivo(s) eliminado(s) de la base de datos`);
            }
          }

          // 3. Eliminar las submissions
          const submissionsDeleted = await Submission.destroy({
            where: { 
              id: { [Op.in]: submissionIds },
              tenant_id: tenantIdKey
            },
            skipTenant: true,
            transaction
          });
          totalDeleted += submissionsDeleted;
          console.log(`      ✅ ${submissionsDeleted} submission(s) eliminada(s)`);

          await transaction.commit();
          console.log(`      ✅ Lote ${batchNumber} completado exitosamente`);

        } catch (error) {
          await transaction.rollback();
          errors++;
          console.error(`      ❌ Error en lote ${batchNumber}:`, error.message);
          logger.error('Error eliminando batch de submissions', { 
            error: error.message, 
            stack: error.stack,
            batchNumber,
            tenantId: tenantIdKey
          });
        }
      }
    }

    // Resumen final
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN');
    console.log('='.repeat(60));
    console.log(`✅ Submissions eliminadas: ${totalDeleted}`);
    console.log(`✅ Archivos eliminados: ${totalFilesDeleted}`);
    console.log(`✅ Evaluaciones eliminadas: ${totalEvaluationsDeleted}`);
    if (errors > 0) {
      console.log(`❌ Errores: ${errors}`);
    }
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('❌ Error en el proceso:', error.message);
    logger.error('Error en deleteAllSubmissions', { error: error.message, stack: error.stack });
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
  } else if (arg.startsWith('--tenant-id=')) {
    options.tenantId = parseInt(arg.split('=')[1], 10);
  } else if (arg.startsWith('--event-id=')) {
    options.eventId = parseInt(arg.split('=')[1], 10);
  } else if (arg.startsWith('--team-id=')) {
    options.teamId = parseInt(arg.split('=')[1], 10);
  } else if (arg === '--help' || arg === '-h') {
    console.log(`
Uso: node delete-all-submissions.js [opciones]

Opciones:
  --dry-run, -d              Modo de prueba (no elimina nada, solo muestra lo que se eliminaría)
  --tenant-id=N              Filtrar por tenant ID específico
  --event-id=N               Filtrar por evento ID específico
  --team-id=N                Filtrar por equipo ID específico
  --help, -h                 Mostrar esta ayuda

Ejemplos:
  # Ver qué se eliminaría (sin eliminar)
  node delete-all-submissions.js --dry-run

  # Eliminar todas las submissions
  node delete-all-submissions.js

  # Eliminar solo submissions de un evento específico
  node delete-all-submissions.js --event-id=1

  # Eliminar solo submissions de un equipo específico
  node delete-all-submissions.js --team-id=5

  # Eliminar submissions de un tenant específico
  node delete-all-submissions.js --tenant-id=1
`);
    process.exit(0);
  }
});

deleteAllSubmissions(options);
