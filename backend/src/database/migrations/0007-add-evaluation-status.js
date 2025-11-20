export async function up(queryInterface, Sequelize) {
  // Agregar campo status ENUM('draft', 'final') con default 'draft' a la tabla evaluations
  await queryInterface.addColumn('evaluations', 'status', {
    type: Sequelize.ENUM('draft', 'final'),
    allowNull: false,
    defaultValue: 'draft'
  });
}

export async function down(queryInterface, Sequelize) {
  // Remover el campo status de la tabla evaluations
  await queryInterface.removeColumn('evaluations', 'status');
}

