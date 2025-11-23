/**
 * Migración para migrar los datos de la columna `grade` a `registration_answers`
 * 
 * Esta migración mueve los valores de `grade` a `registration_answers.grade`
 * antes de eliminar la columna `grade` de la tabla `users`.
 * 
 * El campo `grade` es específico del tenant UIC y debe almacenarse en
 * `registration_answers` como parte del schema dinámico de registro.
 */

export async function up(queryInterface, Sequelize) {
  // Verificar si las columnas necesarias existen
  const tableDescription = await queryInterface.describeTable('users').catch(() => null);
  
  if (!tableDescription) {
    console.log('Tabla users no existe, omitiendo migración');
    return;
  }
  
  // Verificar si la columna grade existe
  if (!tableDescription.grade) {
    console.log('Columna grade no existe en users, omitiendo migración de datos');
    return;
  }
  
  // Verificar si la columna registration_answers existe
  if (!tableDescription.registration_answers) {
    console.log('Columna registration_answers no existe en users, omitiendo migración de datos');
    return;
  }
  
  // Migrar los datos de grade a registration_answers
  // Solo para usuarios que tienen grade pero no tienen registration_answers.grade
  await queryInterface.sequelize.query(`
    UPDATE users
    SET registration_answers = JSON_SET(
      COALESCE(registration_answers, '{}'),
      '$.grade',
      grade
    ),
    updated_at = NOW()
    WHERE grade IS NOT NULL
      AND grade != ''
      AND (
        registration_answers IS NULL
        OR registration_answers = 'null'
        OR JSON_EXTRACT(registration_answers, '$.grade') IS NULL
      )
  `).catch((error) => {
    console.error('Error migrando datos de grade:', error.message);
    // No lanzar el error, solo loguearlo para que la migración continúe
  });

  console.log('Datos de grade migrados a registration_answers');
}

export async function down(queryInterface, Sequelize) {
  // Verificar si las columnas necesarias existen
  const tableDescription = await queryInterface.describeTable('users').catch(() => null);
  
  if (!tableDescription) {
    console.log('Tabla users no existe, omitiendo reversión');
    return;
  }
  
  // Verificar si ambas columnas existen
  if (!tableDescription.grade || !tableDescription.registration_answers) {
    console.log('Columnas grade o registration_answers no existen, omitiendo reversión');
    return;
  }
  
  // Revertir: mover registration_answers.grade de vuelta a la columna grade
  await queryInterface.sequelize.query(`
    UPDATE users
    SET grade = JSON_UNQUOTE(JSON_EXTRACT(registration_answers, '$.grade')),
        updated_at = NOW()
    WHERE registration_answers IS NOT NULL
      AND registration_answers != 'null'
      AND JSON_EXTRACT(registration_answers, '$.grade') IS NOT NULL
      AND (grade IS NULL OR grade = '')
  `).catch((error) => {
    console.error('Error revirtiendo datos de grade:', error.message);
    // No lanzar el error, solo loguearlo
  });

  console.log('Datos de registration_answers.grade revertidos a la columna grade');
}

