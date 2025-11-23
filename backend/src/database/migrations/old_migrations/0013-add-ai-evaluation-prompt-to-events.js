export async function up(queryInterface, Sequelize) {
  // Verificar si la columna ya existe antes de agregarla
  const tableDescription = await queryInterface.describeTable('events');
  
  if (!tableDescription.ai_evaluation_prompt) {
    await queryInterface.addColumn('events', 'ai_evaluation_prompt', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Prompt personalizado para la evaluación con IA en texto plano (un solo idioma). El idioma de respuesta se indica al ejecutar el prompt. Si está vacío, se usa el prompt por defecto.'
    });
  }
}

export async function down(queryInterface, Sequelize) {
  // Verificar si la columna existe antes de removerla
  const tableDescription = await queryInterface.describeTable('events');
  
  if (tableDescription.ai_evaluation_prompt) {
    await queryInterface.removeColumn('events', 'ai_evaluation_prompt');
  }
}

