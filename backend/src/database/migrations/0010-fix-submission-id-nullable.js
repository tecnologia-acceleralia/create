export async function up(queryInterface, Sequelize) {
  // La migración 0009 intentó hacer submission_id nullable pero falló por la foreign key
  // Necesitamos eliminar la FK, cambiar la columna, y recrear la FK
  
  // Buscar el nombre de la foreign key constraint
  const [results] = await queryInterface.sequelize.query(
    `SELECT CONSTRAINT_NAME 
     FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'evaluations' 
     AND COLUMN_NAME = 'submission_id' 
     AND REFERENCED_TABLE_NAME = 'submissions'`
  );
  
  const fkName = results[0]?.CONSTRAINT_NAME;
  
  if (fkName) {
    // Eliminar la foreign key constraint
    await queryInterface.sequelize.query(
      `ALTER TABLE evaluations DROP FOREIGN KEY \`${fkName}\``
    );
  }
  
  // Cambiar la columna para permitir NULL
  await queryInterface.changeColumn('evaluations', 'submission_id', {
    type: Sequelize.INTEGER.UNSIGNED,
    allowNull: true,
    comment: 'ID de la submission evaluada (nullable para evaluaciones de fase/proyecto)'
  });
  
  // Recrear la foreign key constraint
  if (fkName) {
    await queryInterface.addConstraint('evaluations', {
      fields: ['submission_id'],
      type: 'foreign key',
      name: fkName,
      references: {
        table: 'submissions',
        field: 'id'
      },
      onDelete: 'CASCADE'
    });
  }
}

export async function down(queryInterface, Sequelize) {
  // Buscar el nombre de la foreign key constraint
  const [results] = await queryInterface.sequelize.query(
    `SELECT CONSTRAINT_NAME 
     FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'evaluations' 
     AND COLUMN_NAME = 'submission_id' 
     AND REFERENCED_TABLE_NAME = 'submissions'`
  );
  
  const fkName = results[0]?.CONSTRAINT_NAME;
  
  if (fkName) {
    // Eliminar la foreign key constraint
    await queryInterface.sequelize.query(
      `ALTER TABLE evaluations DROP FOREIGN KEY \`${fkName}\``
    );
  }
  
  // Revertir la columna a NOT NULL
  await queryInterface.changeColumn('evaluations', 'submission_id', {
    type: Sequelize.INTEGER.UNSIGNED,
    allowNull: false
  });
  
  // Recrear la foreign key constraint
  if (fkName) {
    await queryInterface.addConstraint('evaluations', {
      fields: ['submission_id'],
      type: 'foreign key',
      name: fkName,
      references: {
        table: 'submissions',
        field: 'id'
      },
      onDelete: 'CASCADE'
    });
  }
}

