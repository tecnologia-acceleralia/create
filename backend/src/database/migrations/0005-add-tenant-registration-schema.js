export async function up(queryInterface, Sequelize) {
  // Agregar campo registration_schema a la tabla tenants
  await queryInterface.addColumn('tenants', 'registration_schema', {
    type: Sequelize.JSON,
    allowNull: true,
    comment: 'Esquema de registro personalizado del tenant'
  });
}

export async function down(queryInterface, Sequelize) {
  // Remover el campo registration_schema de la tabla tenants
  await queryInterface.removeColumn('tenants', 'registration_schema');
}

