export async function up(queryInterface, Sequelize) {
  // Verificar qué columnas ya existen antes de agregarlas
  const tableDescription = await queryInterface.describeTable('events');
  
  if (!tableDescription.ai_evaluation_model) {
    await queryInterface.addColumn('events', 'ai_evaluation_model', {
      type: Sequelize.STRING(100),
      allowNull: true,
      comment: 'Modelo de OpenAI a usar para la evaluación con IA. Si está vacío, se usa el modelo por defecto del sistema.'
    });
  }

  if (!tableDescription.ai_evaluation_temperature) {
    await queryInterface.addColumn('events', 'ai_evaluation_temperature', {
      type: Sequelize.DECIMAL(3, 2),
      allowNull: true,
      comment: 'Temperatura para la evaluación con IA (0-2). Si está vacío, se usa 0.2 por defecto.'
    });
  }

  if (!tableDescription.ai_evaluation_max_tokens) {
    await queryInterface.addColumn('events', 'ai_evaluation_max_tokens', {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: true,
      comment: 'Máximo de tokens en la respuesta de OpenAI. Si está vacío, no se limita.'
    });
  }

  if (!tableDescription.ai_evaluation_top_p) {
    await queryInterface.addColumn('events', 'ai_evaluation_top_p', {
      type: Sequelize.DECIMAL(3, 2),
      allowNull: true,
      comment: 'Top-p (nucleus sampling) para la evaluación con IA (0-1). Si está vacío, se usa 1.0 por defecto.'
    });
  }

  if (!tableDescription.ai_evaluation_frequency_penalty) {
    await queryInterface.addColumn('events', 'ai_evaluation_frequency_penalty', {
      type: Sequelize.DECIMAL(3, 2),
      allowNull: true,
      comment: 'Penalización por frecuencia para la evaluación con IA (-2.0 a 2.0). Si está vacío, se usa 0.0 por defecto.'
    });
  }

  if (!tableDescription.ai_evaluation_presence_penalty) {
    await queryInterface.addColumn('events', 'ai_evaluation_presence_penalty', {
      type: Sequelize.DECIMAL(3, 2),
      allowNull: true,
      comment: 'Penalización por presencia para la evaluación con IA (-2.0 a 2.0). Si está vacío, se usa 0.0 por defecto.'
    });
  }
}

export async function down(queryInterface, Sequelize) {
  // Verificar qué columnas existen antes de removerlas
  const tableDescription = await queryInterface.describeTable('events');
  
  if (tableDescription.ai_evaluation_model) {
    await queryInterface.removeColumn('events', 'ai_evaluation_model');
  }
  if (tableDescription.ai_evaluation_temperature) {
    await queryInterface.removeColumn('events', 'ai_evaluation_temperature');
  }
  if (tableDescription.ai_evaluation_max_tokens) {
    await queryInterface.removeColumn('events', 'ai_evaluation_max_tokens');
  }
  if (tableDescription.ai_evaluation_top_p) {
    await queryInterface.removeColumn('events', 'ai_evaluation_top_p');
  }
  if (tableDescription.ai_evaluation_frequency_penalty) {
    await queryInterface.removeColumn('events', 'ai_evaluation_frequency_penalty');
  }
  if (tableDescription.ai_evaluation_presence_penalty) {
    await queryInterface.removeColumn('events', 'ai_evaluation_presence_penalty');
  }
}

