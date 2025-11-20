export async function up(queryInterface, Sequelize) {
  // Eliminar la columna avatar_url de la tabla users
  await queryInterface.removeColumn('users', 'avatar_url');
}

export async function down(queryInterface, Sequelize) {
  // Restaurar la columna avatar_url en la tabla users
  await queryInterface.addColumn('users', 'avatar_url', {
    type: Sequelize.STRING(500),
    allowNull: true
  });
}

