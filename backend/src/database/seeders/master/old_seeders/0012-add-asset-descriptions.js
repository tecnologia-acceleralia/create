/**
 * Seeder que añade descripciones a los recursos existentes en event_assets.
 * Si un recurso no tiene descripción, se genera una basada en el nombre del archivo.
 * 
 * Dependencias: requiere que la migración 0006-add-asset-description.js haya sido ejecutada.
 * IMPORTANTE: Este seeder es idempotente y verifica la existencia de la columna antes de usarla.
 */

export async function up(queryInterface) {
  // Verificar que la columna description existe (debe existir después de la migración 0006)
  const tableDescription = await queryInterface.describeTable('event_assets').catch(() => null);
  
  if (!tableDescription) {
    throw new Error('La tabla event_assets no existe. Ejecuta primero las migraciones.');
  }

  if (!tableDescription.description) {
    console.log('⚠ La columna description no existe en la tabla event_assets. Este seeder requiere la migración 0006-add-asset-description.js');
    console.log('⚠ Omitiendo este seeder. Los assets se crearán sin descripción hasta que se ejecute la migración correspondiente.');
    return;
  }

  // Obtener todos los assets sin descripción
  const [assets] = await queryInterface.sequelize.query(`
    SELECT id, name, original_filename, url
    FROM event_assets
    WHERE description IS NULL OR description = ''
  `);

  if (assets.length === 0) {
    console.log('✓ No hay recursos sin descripción que actualizar.');
    return;
  }

  console.log(`✓ Encontrados ${assets.length} recursos sin descripción.`);

  let updatedCount = 0;

  for (const asset of assets) {
    // Generar descripción basada en el nombre del archivo
    // Eliminar extensión y normalizar para mostrar
    let description = asset.original_filename || asset.name;
    
    // Eliminar extensión
    const lastDotIndex = description.lastIndexOf('.');
    if (lastDotIndex > 0) {
      description = description.substring(0, lastDotIndex);
    }
    
    // Reemplazar guiones bajos y guiones por espacios
    description = description.replace(/[_-]/g, ' ');
    
    // Capitalizar primera letra de cada palabra
    description = description
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
      .trim();
    
    // Si la descripción está vacía después de procesar, usar el nombre original
    if (!description || description.length === 0) {
      description = asset.original_filename || asset.name;
    }
    
    // Limitar a 500 caracteres
    if (description.length > 500) {
      description = description.substring(0, 497) + '...';
    }

    try {
      await queryInterface.sequelize.query(
        `UPDATE event_assets SET description = :description WHERE id = :id`,
        {
          replacements: {
            id: asset.id,
            description: description
          }
        }
      );
      updatedCount++;
      console.log(`✓ Actualizado: ${asset.name} -> "${description}"`);
    } catch (error) {
      console.error(`✗ Error actualizando ${asset.name}:`, error.message);
    }
  }

  console.log(`\n✓ Seeder completado. ${updatedCount} recursos actualizados.`);
}

export async function down(queryInterface) {
  // Eliminar todas las descripciones (establecer a NULL)
  await queryInterface.sequelize.query(`
    UPDATE event_assets SET description = NULL
  `);
  console.log('✓ Descripciones eliminadas.');
}

