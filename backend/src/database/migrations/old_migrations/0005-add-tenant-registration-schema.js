export async function up(queryInterface, Sequelize) {
  // Verificar si la columna registration_schema ya existe antes de agregarla
  // Esta columna ya está definida en 0001-create-core-tables.js, pero esta migración
  // se mantiene para casos donde la base de datos se creó antes de incluirla en 0001
  const tableDescription = await queryInterface.describeTable('tenants');
  
  if (!tableDescription.registration_schema) {
    await queryInterface.addColumn('tenants', 'registration_schema', {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'Esquema de registro personalizado del tenant'
    });
  }
}

export async function down(queryInterface, Sequelize) {
  // Verificar si la columna existe antes de removerla
  const tableDescription = await queryInterface.describeTable('tenants');
  
  if (tableDescription.registration_schema) {
    await queryInterface.removeColumn('tenants', 'registration_schema');
  }
}

