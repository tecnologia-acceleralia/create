export async function up(queryInterface, Sequelize) {
  // Añadir 'none' al ENUM de delivery_type en la tabla tasks
  await queryInterface.sequelize.query(`
    ALTER TABLE tasks 
    MODIFY COLUMN delivery_type ENUM('text', 'file', 'url', 'video', 'audio', 'zip', 'none') 
    DEFAULT 'file'
  `);
}

export async function down(queryInterface, Sequelize) {
  // Remover 'none' del ENUM de delivery_type
  // Primero actualizar cualquier registro con 'none' a 'file'
  await queryInterface.sequelize.query(`
    UPDATE tasks 
    SET delivery_type = 'file' 
    WHERE delivery_type = 'none'
  `);
  
  // Luego modificar el ENUM para remover 'none'
  await queryInterface.sequelize.query(`
    ALTER TABLE tasks 
    MODIFY COLUMN delivery_type ENUM('text', 'file', 'url', 'video', 'audio', 'zip') 
    DEFAULT 'file'
  `);
}

