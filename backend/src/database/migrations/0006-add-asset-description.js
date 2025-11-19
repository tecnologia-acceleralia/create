export async function up(queryInterface, Sequelize) {
  // Verificar si la columna description ya existe antes de agregarla
  const tableDescription = await queryInterface.describeTable('event_assets');
  
  if (!tableDescription.description) {
    await queryInterface.addColumn('event_assets', 'description', {
      type: Sequelize.STRING(500),
      allowNull: true,
      comment: 'Texto descriptivo del recurso que se mostrará en lugar de la URL completa'
    });
  }
}

export async function down(queryInterface, Sequelize) {
  // Verificar si la columna existe antes de removerla
  const tableDescription = await queryInterface.describeTable('event_assets');
  
  if (tableDescription.description) {
    await queryInterface.removeColumn('event_assets', 'description');
  }
}

