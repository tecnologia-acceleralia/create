/**
 * Seeder que actualiza los usuarios existentes del tenant UIC con el campo registration_answers.
 * 
 * Este seeder inicializa `registration_answers` como un objeto vacío {} para usuarios del tenant UIC
 * que no tienen este campo configurado. Esto indica que el usuario completó el registro según el schema.
 * 
 * NOTA: Este seeder se ejecuta DESPUÉS de las migraciones que eliminan la columna `grade`.
 * La migración 0016-migrate-grade-to-registration-answers.js ya migró los datos de `grade` a
 * `registration_answers.grade` antes de eliminar la columna. Este seeder solo asegura que los
 * usuarios nuevos o que no tenían `grade` tengan `registration_answers` inicializado.
 * 
 * IMPORTANTE: Este seeder es idempotente y verifica la existencia de la columna antes de usarla.
 * Si la columna no existe, el seeder se omite silenciosamente (útil cuando se resetea desde cero).
 * 
 * Dependencias:
 * - Requiere que el tenant 'uic' exista (0002-uic-tenant.js)
 * - Requiere que el schema de registro esté configurado (0008-uic-tenant-registration-schema.js)
 * - Requiere que los usuarios existan (0003-uic-evaluator-users.js, 0004-uic-test-users.js)
 * - Requiere que la migración 0015-add-registration-answers-to-users.js haya sido ejecutada
 *   (si no existe, el seeder se omite automáticamente)
 */

export async function up(queryInterface) {
  const [[tenant]] = await queryInterface.sequelize.query(
    "SELECT id FROM tenants WHERE slug = 'uic' LIMIT 1"
  );

  if (!tenant) {
    throw new Error('No se encontró el tenant UIC. Ejecuta primero el seeder 0002-uic-tenant.js');
  }

  // Verificar que la columna registration_answers existe (debe existir después de la migración 0015)
  const tableDescription = await queryInterface.describeTable('users').catch(() => null);
  
  if (!tableDescription) {
    throw new Error('La tabla users no existe. Ejecuta primero las migraciones.');
  }

  if (!tableDescription.registration_answers) {
    console.log('⚠ La columna registration_answers no existe en la tabla users. Este seeder requiere la migración 0015-add-registration-answers-to-users.js');
    console.log('⚠ Omitiendo este seeder. Los usuarios se crearán con registration_answers cuando se ejecute la migración correspondiente.');
    return;
  }

  // Obtener todos los usuarios del tenant UIC que no tienen registration_answers configurado
  // (ya no leemos la columna grade porque fue eliminada por la migración 0017)
  const users = await queryInterface.sequelize.query(
    `SELECT u.id, u.email, u.registration_answers
     FROM users u
     INNER JOIN user_tenants ut ON u.id = ut.user_id
     WHERE ut.tenant_id = :tenantId
       AND (
         u.registration_answers IS NULL 
         OR u.registration_answers = 'null' 
         OR u.registration_answers = '{}'
       )
     ORDER BY u.id`,
    {
      replacements: { tenantId: tenant.id },
      type: queryInterface.sequelize.QueryTypes.SELECT
    }
  );

  if (users.length === 0) {
    console.log('No hay usuarios del tenant UIC que necesiten actualización de registration_answers');
    return;
  }

  console.log(`Inicializando registration_answers para ${users.length} usuarios del tenant UIC...`);

  // Inicializar registration_answers como objeto vacío para usuarios que no lo tienen
  // (los usuarios que tenían grade ya fueron migrados por la migración 0016)
  for (const user of users) {
    // Solo inicializar si realmente está vacío/null
    // Si ya tiene datos (migrados por 0016), no tocarlo
    await queryInterface.sequelize.query(
      `UPDATE users 
       SET registration_answers = '{}', updated_at = NOW() 
       WHERE id = :userId
         AND (
           registration_answers IS NULL 
           OR registration_answers = 'null'
         )`,
      {
        replacements: { 
          userId: user.id 
        }
      }
    );
  }

  console.log(`Se inicializó registration_answers para usuarios del tenant UIC`);
}

export async function down(queryInterface) {
  const [[tenant]] = await queryInterface.sequelize.query(
    "SELECT id FROM tenants WHERE slug = 'uic' LIMIT 1"
  );

  if (!tenant) {
    return;
  }

  // Establecer registration_answers a NULL para los usuarios del tenant UIC
  await queryInterface.sequelize.query(
    `UPDATE users u
     INNER JOIN user_tenants ut ON u.id = ut.user_id
     SET u.registration_answers = NULL, u.updated_at = NOW()
     WHERE ut.tenant_id = :tenantId
       AND u.registration_answers IS NOT NULL`,
    {
      replacements: { tenantId: tenant.id }
    }
  );

  console.log('Se revirtieron los cambios de registration_answers para usuarios del tenant UIC');
}

