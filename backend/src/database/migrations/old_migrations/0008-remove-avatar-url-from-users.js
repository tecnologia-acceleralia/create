export async function up(queryInterface, Sequelize) {
  // Verificar si la columna avatar_url existe antes de eliminarla
  const tableDescription = await queryInterface.describeTable('users');
  
  if (tableDescription.avatar_url) {
    // Eliminar la columna avatar_url de la tabla users
    await queryInterface.removeColumn('users', 'avatar_url');
  }
}

export async function down(queryInterface, Sequelize) {
  // Verificar si la columna avatar_url no existe antes de restaurarla
  const tableDescription = await queryInterface.describeTable('users');
  
  if (!tableDescription.avatar_url) {
    // Restaurar la columna avatar_url en la tabla users
    await queryInterface.addColumn('users', 'avatar_url', {
      type: Sequelize.STRING(500),
      allowNull: true
    });
  }
}

