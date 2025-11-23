export async function up(queryInterface, Sequelize) {
  // Verificar si la tabla notifications existe
  const tables = await queryInterface.showAllTables();
  if (!tables.includes('notifications')) {
    return;
  }
  
  const tableDescription = await queryInterface.describeTable('notifications');
  
  // Corregir los campos created_at y updated_at de la tabla notifications
  // para que se actualicen automáticamente como en otras tablas
  
  // Primero, actualizar registros existentes que puedan tener NULL
  await queryInterface.sequelize.query(
    `UPDATE notifications 
     SET created_at = CURRENT_TIMESTAMP 
     WHERE created_at IS NULL`
  ).catch(() => {
    // Ignorar errores si no hay registros
  });
  
  await queryInterface.sequelize.query(
    `UPDATE notifications 
     SET updated_at = CURRENT_TIMESTAMP 
     WHERE updated_at IS NULL`
  ).catch(() => {
    // Ignorar errores si no hay registros
  });
  
  // Modificar created_at solo si existe y necesita cambios
  if (tableDescription.created_at) {
    await queryInterface.changeColumn('notifications', 'created_at', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    }).catch(() => {
      // Ignorar errores si ya está configurado correctamente
    });
  }
  
  // Modificar updated_at solo si existe y necesita cambios
  if (tableDescription.updated_at) {
    await queryInterface.changeColumn('notifications', 'updated_at', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
    }).catch(() => {
      // Ignorar errores si ya está configurado correctamente
    });
  }
}

export async function down(queryInterface, Sequelize) {
  // Revertir a la configuración anterior (sin allowNull y con Sequelize.NOW)
  await queryInterface.changeColumn('notifications', 'created_at', {
    type: Sequelize.DATE,
    allowNull: true,
    defaultValue: Sequelize.NOW
  });
  
  await queryInterface.changeColumn('notifications', 'updated_at', {
    type: Sequelize.DATE,
    allowNull: true,
    defaultValue: Sequelize.NOW
  });
}

