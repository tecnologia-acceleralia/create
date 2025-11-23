export async function up(queryInterface, Sequelize) {
  // Verificar si la columna status ya existe antes de agregarla
  const tableDescription = await queryInterface.describeTable('evaluations');
  
  if (!tableDescription.status) {
    // Agregar campo status ENUM('draft', 'final') con default 'draft' a la tabla evaluations
    await queryInterface.addColumn('evaluations', 'status', {
      type: Sequelize.ENUM('draft', 'final'),
      allowNull: false,
      defaultValue: 'draft'
    });
  }
}

export async function down(queryInterface, Sequelize) {
  // Verificar si la columna status existe antes de removerla
  const tableDescription = await queryInterface.describeTable('evaluations');
  
  if (tableDescription.status) {
    // Remover el campo status de la tabla evaluations
    await queryInterface.removeColumn('evaluations', 'status');
  }
}

