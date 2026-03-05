'use strict';

/**
 * Rellena created_at en notificaciones donde es NULL o fecha inválida/cero
 * (p. ej. 0000-00-00 en MySQL), para que la UI muestre la fecha correctamente.
 */
export async function up(queryInterface) {
  const dialect = queryInterface.sequelize.getDialect?.() ?? 'mysql';
  const isMySQL = dialect === 'mysql';

  if (isMySQL) {
    await queryInterface.sequelize.query(
      `UPDATE notifications
       SET created_at = COALESCE(updated_at, CURRENT_TIMESTAMP)
       WHERE created_at IS NULL
          OR created_at = '0000-00-00 00:00:00'
          OR created_at < '2000-01-01 00:00:00'`
    ).catch(() => {});
  } else {
    await queryInterface.sequelize.query(
      `UPDATE notifications
       SET created_at = COALESCE(updated_at, CURRENT_TIMESTAMP)
       WHERE created_at IS NULL`
    ).catch(() => {});
  }
}

export async function down() {
  // Cambio solo de datos, no reversible
}
