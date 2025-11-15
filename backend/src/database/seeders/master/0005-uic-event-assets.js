import {
  listEventAssetsFromS3,
  getMimeTypeFromFileName,
  buildPublicUrl,
  normalizeFileName
} from '../../../utils/s3-utils.js';
import { getS3ClientAndSettings } from '../../../services/tenant-assets.service.js';

/**
 * Seeder que obtiene los recursos existentes en S3 para el evento UIC SPP 2026
 * y crea los registros correspondientes en event_assets.
 * 
 * Dependencias: requiere que el tenant 'uic' y el evento 'SPP 2026' existan (0002-uic-tenant.js).
 * Los recursos deben estar previamente subidos a S3 en la ruta: tenants/{tenantId}/events/{eventId}/assets/
 */

export async function up(queryInterface) {
  const [[tenant]] = await queryInterface.sequelize.query(
    "SELECT id FROM tenants WHERE slug = 'uic' LIMIT 1"
  );

  if (!tenant) {
    throw new Error('No se encontró el tenant UIC. Ejecuta primero el seeder 0002-uic-tenant.js');
  }

  const [[event]] = await queryInterface.sequelize.query(
    `SELECT id FROM events WHERE tenant_id = ${tenant.id} AND name = 'SPP 2026' LIMIT 1`
  );

  if (!event) {
    throw new Error('No se encontró el evento SPP 2026. Ejecuta primero el seeder 0002-uic-tenant.js');
  }

  // Obtener el usuario admin para uploaded_by
  const [[adminUser]] = await queryInterface.sequelize.query(
    "SELECT id FROM users WHERE email = 'admin@uic.cat' LIMIT 1"
  );

  if (!adminUser) {
    throw new Error('No se encontró el usuario administrador de UIC.');
  }

  // Obtener recursos desde S3
  console.log(`Buscando recursos en S3 para el evento ${event.id}...`);
  const s3Objects = await listEventAssetsFromS3(tenant.id, event.id);

  if (s3Objects.length === 0) {
    console.log('⚠ No se encontraron recursos en S3. Asegúrate de que los archivos estén subidos.');
    return;
  }

  console.log(`✓ Encontrados ${s3Objects.length} recursos en S3`);

  // Normalizar nombres de archivos (eliminar acentos)
  const mappedAssets = s3Objects.map(s3Object => {
    const normalizedName = normalizeFileName(s3Object.fileName);
    return {
      ...s3Object,
      assetName: normalizedName, // Nombre normalizado sin acentos
      originalFileName: normalizedName
    };
  });

  let createdCount = 0;
  let skippedCount = 0;

  // Crear registros en la BD para cada recurso encontrado
  for (const asset of mappedAssets) {
    try {
      // Verificar si el asset ya existe (idempotencia)
      const [existingAssets] = await queryInterface.sequelize.query(
        `SELECT id FROM event_assets WHERE tenant_id = :tenantId AND event_id = :eventId AND name = :assetName LIMIT 1`,
        {
          replacements: {
            tenantId: tenant.id,
            eventId: event.id,
            assetName: asset.assetName
          }
        }
      );

      if (existingAssets.length > 0) {
        // El asset ya existe, actualizar el original_filename si es necesario
        skippedCount++;
        console.log(`✓ Asset existente: ${asset.assetName}`);
        
        // Actualizar original_filename si es diferente
        await queryInterface.sequelize.query(
          `UPDATE event_assets SET original_filename = :originalFilename WHERE tenant_id = :tenantId AND event_id = :eventId AND name = :assetName`,
          {
            replacements: {
              tenantId: tenant.id,
              eventId: event.id,
              assetName: asset.assetName,
              originalFilename: asset.originalFileName
            }
          }
        );
        continue;
      }

      // Construir la URL pública del objeto
      const s3Url = buildPublicUrl(asset.s3Key);
      if (!s3Url) {
        throw new Error('No se pudo construir la URL pública del objeto S3.');
      }

      const mimeType = getMimeTypeFromFileName(asset.originalFileName);
      const now = asset.lastModified || new Date();

      // Crear el registro en la BD con el nombre normalizado
      await queryInterface.bulkInsert(
        'event_assets',
        [
          {
            tenant_id: tenant.id,
            event_id: event.id,
            name: asset.assetName, // Nombre normalizado sin acentos (usado en marcadores)
            original_filename: asset.originalFileName, // Nombre normalizado sin acentos
            s3_key: asset.s3Key,
            url: s3Url,
            mime_type: mimeType,
            file_size: asset.fileSize,
            uploaded_by: adminUser.id,
            created_at: now,
            updated_at: now
          }
        ]
      );

      createdCount++;
      console.log(`✓ Registro creado: ${asset.assetName} -> ${s3Url}`);
    } catch (error) {
      console.error(`✗ Error procesando ${asset.assetName}:`, error.message);
      // Continuar con el siguiente archivo
    }
  }

  console.log(`\n✓ Seeder completado. ${createdCount} nuevos registros creados, ${skippedCount} ya existían.`);
}

export async function down(queryInterface) {
  const [[tenant]] = await queryInterface.sequelize.query(
    "SELECT id FROM tenants WHERE slug = 'uic' LIMIT 1"
  );

  if (!tenant) {
    return;
  }

  const [[event]] = await queryInterface.sequelize.query(
    `SELECT id FROM events WHERE tenant_id = ${tenant.id} AND name = 'SPP 2026' LIMIT 1`
  );

  if (event) {
    await queryInterface.bulkDelete('event_assets', {
      tenant_id: tenant.id,
      event_id: event.id
    });
  }
}
