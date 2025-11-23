/**
 * Migración para eliminar la columna `grade` de la tabla `users`
 * 
 * Esta migración elimina la columna `grade` ya que este campo es específico
 * del tenant UIC y debe almacenarse en `registration_answers` como parte
 * del schema dinámico de registro.
 * 
 * IMPORTANTE: Esta migración requiere que la migración 0016-migrate-grade-to-registration-answers.js
 * haya sido ejecutada primero para migrar los datos existentes.
 */

export async function up(queryInterface, Sequelize) {
  // Verificar si la columna grade existe antes de eliminarla
  const tableDescription = await queryInterface.describeTable('users');
  
  if (tableDescription.grade) {
    // Eliminar la columna grade de la tabla users
    await queryInterface.removeColumn('users', 'grade');
    console.log('Columna grade eliminada de la tabla users');
  } else {
    console.log('Columna grade no existe en la tabla users, omitiendo eliminación');
  }
}

export async function down(queryInterface, Sequelize) {
  // Verificar si la columna grade no existe antes de restaurarla
  const tableDescription = await queryInterface.describeTable('users');
  
  if (!tableDescription.grade) {
    // Restaurar la columna grade en la tabla users
    await queryInterface.addColumn('users', 'grade', {
      type: Sequelize.STRING(255),
      allowNull: true
    });
    console.log('Columna grade restaurada en la tabla users');
  } else {
    console.log('Columna grade ya existe en la tabla users, omitiendo restauración');
  }
}

