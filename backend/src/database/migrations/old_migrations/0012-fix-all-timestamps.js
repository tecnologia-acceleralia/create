export async function up(queryInterface, Sequelize) {
  // Corregir todos los campos created_at y updated_at de todas las tablas
  // para que se actualicen automáticamente como en las tablas correctas
  
  const tablesToFix = [
    'tenants',
    'roles',
    'users',
    'user_tenants',
    'user_tenant_roles',
    'events',
    'phases',
    'teams',
    'team_members',
    'projects',
    'tasks',
    'submissions',
    'evaluations',
    'password_reset_tokens',
    'event_assets'
  ];
  
  // Obtener lista de tablas existentes
  const existingTables = await queryInterface.showAllTables();
  
  for (const tableName of tablesToFix) {
    // Verificar si la tabla existe
    if (!existingTables.includes(tableName)) {
      continue;
    }
    
    const tableDescription = await queryInterface.describeTable(tableName).catch(() => null);
    if (!tableDescription) {
      continue;
    }
    
    // Actualizar registros existentes que puedan tener NULL en created_at
    if (tableDescription.created_at) {
      await queryInterface.sequelize.query(
        `UPDATE ${tableName} 
         SET created_at = CURRENT_TIMESTAMP 
         WHERE created_at IS NULL`
      ).catch(() => {
        // Ignorar errores si no hay registros
      });
    }
    
    // Actualizar registros existentes que puedan tener NULL en updated_at
    if (tableDescription.updated_at) {
      await queryInterface.sequelize.query(
        `UPDATE ${tableName} 
         SET updated_at = CURRENT_TIMESTAMP 
         WHERE updated_at IS NULL`
      ).catch(() => {
        // Ignorar errores si no hay registros
      });
    }
    
    // Modificar created_at para que tenga allowNull: false y defaultValue automático
    if (tableDescription.created_at) {
      await queryInterface.changeColumn(tableName, 'created_at', {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }).catch(() => {
        // Ignorar errores si ya está configurado correctamente
      });
    }
    
    // Modificar updated_at para que tenga allowNull: false y se actualice automáticamente
    if (tableDescription.updated_at) {
      await queryInterface.changeColumn(tableName, 'updated_at', {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }).catch(() => {
        // Ignorar errores si ya está configurado correctamente
      });
    }
  }
}

export async function down(queryInterface, Sequelize) {
  // Revertir a la configuración anterior (sin allowNull y con Sequelize.NOW)
  const tablesToRevert = [
    'tenants',
    'roles',
    'users',
    'user_tenants',
    'user_tenant_roles',
    'events',
    'phases',
    'teams',
    'team_members',
    'projects',
    'tasks',
    'submissions',
    'evaluations',
    'password_reset_tokens',
    'event_assets'
  ];
  
  for (const tableName of tablesToRevert) {
    await queryInterface.changeColumn(tableName, 'created_at', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: Sequelize.NOW
    }).catch(() => {
      // Ignorar errores si la columna no existe
    });
    
    await queryInterface.changeColumn(tableName, 'updated_at', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: Sequelize.NOW
    }).catch(() => {
      // Ignorar errores si la columna no existe
    });
  }
}

