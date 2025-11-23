/**
 * Migración para agregar el campo registration_answers a la tabla users
 * 
 * Este campo almacena las respuestas adicionales del usuario al completar
 * el formulario de registro según el schema de registro del tenant.
 * 
 * El campo es de tipo JSON y nullable, permitiendo almacenar cualquier
 * estructura de datos según los campos adicionales definidos en el schema.
 */

export async function up(queryInterface, Sequelize) {
  // Verificar si la columna ya existe antes de agregarla
  const tableDescription = await queryInterface.describeTable('users');
  
  if (!tableDescription.registration_answers) {
    await queryInterface.addColumn('users', 'registration_answers', {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'Respuestas adicionales del usuario al formulario de registro según el schema del tenant'
    });
  }
}

export async function down(queryInterface, Sequelize) {
  // Verificar si la columna existe antes de removerla
  const tableDescription = await queryInterface.describeTable('users');
  
  if (tableDescription.registration_answers) {
    // Eliminar la columna registration_answers de la tabla users
    await queryInterface.removeColumn('users', 'registration_answers');
  }
}

