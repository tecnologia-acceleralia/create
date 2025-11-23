/**
 * Migración para convertir campos de texto a JSON multiidioma
 * 
 * Convierte los siguientes campos a JSON con estructura { "es": "...", "ca": "...", "en": "..." }:
 * - events: name, description, description_html
 * - tasks: title, description, intro_html
 * - phases: name, description, intro_html
 * 
 * Los datos existentes se migran al idioma español (es) como base.
 */

export async function up(queryInterface, Sequelize) {
  // Verificar si la migración ya se ejecutó comprobando si las columnas finales ya son JSON
  const eventsDescription = await queryInterface.describeTable('events').catch(() => null);
  
  if (eventsDescription) {
    // Verificar si las columnas ya están migradas (son JSON)
    // Si name es JSON, significa que la migración ya se completó
    const nameColumn = eventsDescription.name;
    if (nameColumn && (nameColumn.type === 'json' || nameColumn.type.includes('json') || nameColumn.type === 'JSON')) {
      console.log('Migración multiidioma ya ejecutada, omitiendo...');
      return;
    }
    
    // Si las columnas temporales existen pero las finales no, significa migración parcial
    // En ese caso, continuamos desde donde quedó
  }
  
  const transaction = await queryInterface.sequelize.transaction();

  try {
    // 1. Migrar campos de events
    console.log('Migrando campos de events...');
    
    // Verificar si las columnas temporales ya existen
    const eventsTableDesc = await queryInterface.describeTable('events', { transaction }).catch(() => ({}));
    
    // Primero, crear columnas temporales solo si no existen
    if (!eventsTableDesc.name_json) {
      await queryInterface.addColumn(
        'events',
        'name_json',
        {
          type: Sequelize.JSON,
          allowNull: true
        },
        { transaction }
      );
    }

    if (!eventsTableDesc.description_json) {
      await queryInterface.addColumn(
        'events',
        'description_json',
        {
          type: Sequelize.TEXT('long'),
          allowNull: true
        },
        { transaction }
      );
    }

    if (!eventsTableDesc.description_html_json) {
      await queryInterface.addColumn(
        'events',
        'description_html_json',
        {
          type: Sequelize.TEXT('long'),
          allowNull: true
        },
        { transaction }
      );
    }

    // Convertir datos existentes a JSON solo si las columnas originales existen
    if (eventsTableDesc.name && eventsTableDesc.name.type !== 'json' && eventsTableDesc.name_json) {
      await queryInterface.sequelize.query(
        `UPDATE events 
         SET name_json = JSON_OBJECT('es', name)
         WHERE name IS NOT NULL`,
        { transaction }
      ).catch(() => {
        // Ignorar errores si no hay datos o la columna no existe
      });
    }
    
    if (eventsTableDesc.description && eventsTableDesc.description.type !== 'text' && eventsTableDesc.description_json) {
      await queryInterface.sequelize.query(
        `UPDATE events 
         SET description_json = CASE 
           WHEN description IS NULL THEN NULL 
           ELSE JSON_OBJECT('es', description) 
         END`,
        { transaction }
      ).catch(() => {
        // Ignorar errores si no hay datos o la columna no existe
      });
    }
    
    if (eventsTableDesc.description_html && eventsTableDesc.description_html.type !== 'text' && eventsTableDesc.description_html_json) {
      await queryInterface.sequelize.query(
        `UPDATE events 
         SET description_html_json = CASE 
           WHEN description_html IS NULL THEN NULL 
           ELSE JSON_OBJECT('es', description_html) 
         END`,
        { transaction }
      ).catch(() => {
        // Ignorar errores si no hay datos o la columna no existe
      });
    }

    // Obtener descripción actualizada después de los cambios
    let currentEventsDesc = await queryInterface.describeTable('events', { transaction }).catch(() => ({}));
    
    // Eliminar columnas antiguas solo si existen y no son JSON
    if (currentEventsDesc.name && currentEventsDesc.name.type !== 'json' && currentEventsDesc.name_json) {
      await queryInterface.removeColumn('events', 'name', { transaction });
      currentEventsDesc = await queryInterface.describeTable('events', { transaction }).catch(() => ({}));
    }
    if (currentEventsDesc.description && currentEventsDesc.description.type !== 'text' && currentEventsDesc.description_json) {
      await queryInterface.removeColumn('events', 'description', { transaction });
      currentEventsDesc = await queryInterface.describeTable('events', { transaction }).catch(() => ({}));
    }
    if (currentEventsDesc.description_html && currentEventsDesc.description_html.type !== 'text' && currentEventsDesc.description_html_json) {
      await queryInterface.removeColumn('events', 'description_html', { transaction });
      currentEventsDesc = await queryInterface.describeTable('events', { transaction }).catch(() => ({}));
    }

    // Renombrar columnas nuevas solo si existen las columnas temporales y no existe la final
    if (currentEventsDesc.name_json && !currentEventsDesc.name) {
      await queryInterface.renameColumn('events', 'name_json', 'name', { transaction });
      currentEventsDesc = await queryInterface.describeTable('events', { transaction }).catch(() => ({}));
    }
    if (currentEventsDesc.description_json && !currentEventsDesc.description) {
      await queryInterface.renameColumn('events', 'description_json', 'description', { transaction });
      currentEventsDesc = await queryInterface.describeTable('events', { transaction }).catch(() => ({}));
    }
    if (currentEventsDesc.description_html_json && !currentEventsDesc.description_html) {
      await queryInterface.renameColumn('events', 'description_html_json', 'description_html', { transaction });
      currentEventsDesc = await queryInterface.describeTable('events', { transaction }).catch(() => ({}));
    }

    // Establecer constraints y comentarios solo si las columnas existen
    if (currentEventsDesc.name) {
      await queryInterface.changeColumn(
        'events',
        'name',
        {
          type: Sequelize.JSON,
          allowNull: false,
          comment: 'Nombre del evento por idioma: { "es": "...", "ca": "...", "en": "..." }'
        },
        { transaction }
      ).catch(() => {
        // Ignorar si ya está configurado correctamente
      });
    }

    if (currentEventsDesc.description) {
      await queryInterface.changeColumn(
        'events',
        'description',
        {
          type: Sequelize.TEXT('long'),
          allowNull: true,
          comment: 'Descripción del evento por idioma: { "es": "...", "ca": "...", "en": "..." }'
        },
        { transaction }
      ).catch(() => {
        // Ignorar si ya está configurado correctamente
      });
    }

    if (currentEventsDesc.description_html) {
      await queryInterface.changeColumn(
        'events',
        'description_html',
        {
          type: Sequelize.TEXT('long'),
          allowNull: true,
          comment: 'Contenido HTML de la descripción por idioma: { "es": "...", "ca": "...", "en": "..." }'
        },
        { transaction }
      ).catch(() => {
        // Ignorar si ya está configurado correctamente
      });
    }

    // 2. Migrar campos de tasks
    console.log('Migrando campos de tasks...');
    
    // Verificar si las columnas temporales ya existen
    const tasksTableDesc = await queryInterface.describeTable('tasks', { transaction }).catch(() => ({}));
    
    // Crear columnas temporales solo si no existen
    if (!tasksTableDesc.title_json) {
      await queryInterface.addColumn(
        'tasks',
        'title_json',
        {
          type: Sequelize.JSON,
          allowNull: true
        },
        { transaction }
      );
    }

    if (!tasksTableDesc.description_json) {
      await queryInterface.addColumn(
        'tasks',
        'description_json',
        {
          type: Sequelize.TEXT('long'),
          allowNull: true
        },
        { transaction }
      );
    }

    if (!tasksTableDesc.intro_html_json) {
      await queryInterface.addColumn(
        'tasks',
        'intro_html_json',
        {
          type: Sequelize.TEXT('long'),
          allowNull: true
        },
        { transaction }
      );
    }

    // Convertir datos existentes a JSON solo si las columnas originales existen
    if (tasksTableDesc.title && tasksTableDesc.title.type !== 'json' && tasksTableDesc.title_json) {
      await queryInterface.sequelize.query(
        `UPDATE tasks 
         SET title_json = JSON_OBJECT('es', title)
         WHERE title IS NOT NULL`,
        { transaction }
      ).catch(() => {
        // Ignorar errores si no hay datos o la columna no existe
      });
    }
    
    if (tasksTableDesc.description && tasksTableDesc.description.type !== 'text' && tasksTableDesc.description_json) {
      await queryInterface.sequelize.query(
        `UPDATE tasks 
         SET description_json = CASE 
           WHEN description IS NULL THEN NULL 
           ELSE JSON_OBJECT('es', description) 
         END`,
        { transaction }
      ).catch(() => {
        // Ignorar errores si no hay datos o la columna no existe
      });
    }
    
    if (tasksTableDesc.intro_html && tasksTableDesc.intro_html.type !== 'text' && tasksTableDesc.intro_html_json) {
      await queryInterface.sequelize.query(
        `UPDATE tasks 
         SET intro_html_json = CASE 
           WHEN intro_html IS NULL THEN NULL 
           ELSE JSON_OBJECT('es', intro_html) 
         END`,
        { transaction }
      ).catch(() => {
        // Ignorar errores si no hay datos o la columna no existe
      });
    }

    // Obtener descripción actualizada después de los cambios
    let currentTasksDesc = await queryInterface.describeTable('tasks', { transaction }).catch(() => ({}));

    // Eliminar columnas antiguas solo si existen y no son JSON
    if (currentTasksDesc.title && currentTasksDesc.title.type !== 'json' && currentTasksDesc.title_json) {
      await queryInterface.removeColumn('tasks', 'title', { transaction });
      currentTasksDesc = await queryInterface.describeTable('tasks', { transaction }).catch(() => ({}));
    }
    if (currentTasksDesc.description && currentTasksDesc.description.type !== 'text' && currentTasksDesc.description_json) {
      await queryInterface.removeColumn('tasks', 'description', { transaction });
      currentTasksDesc = await queryInterface.describeTable('tasks', { transaction }).catch(() => ({}));
    }
    if (currentTasksDesc.intro_html && currentTasksDesc.intro_html.type !== 'text' && currentTasksDesc.intro_html_json) {
      await queryInterface.removeColumn('tasks', 'intro_html', { transaction });
      currentTasksDesc = await queryInterface.describeTable('tasks', { transaction }).catch(() => ({}));
    }

    // Renombrar columnas nuevas solo si existen las columnas temporales y no existe la final
    if (currentTasksDesc.title_json && !currentTasksDesc.title) {
      await queryInterface.renameColumn('tasks', 'title_json', 'title', { transaction });
      currentTasksDesc = await queryInterface.describeTable('tasks', { transaction }).catch(() => ({}));
    }
    if (currentTasksDesc.description_json && !currentTasksDesc.description) {
      await queryInterface.renameColumn('tasks', 'description_json', 'description', { transaction });
      currentTasksDesc = await queryInterface.describeTable('tasks', { transaction }).catch(() => ({}));
    }
    if (currentTasksDesc.intro_html_json && !currentTasksDesc.intro_html) {
      await queryInterface.renameColumn('tasks', 'intro_html_json', 'intro_html', { transaction });
      currentTasksDesc = await queryInterface.describeTable('tasks', { transaction }).catch(() => ({}));
    }

    // Establecer constraints y comentarios solo si las columnas existen
    if (currentTasksDesc.title) {
      await queryInterface.changeColumn(
        'tasks',
        'title',
        {
          type: Sequelize.JSON,
          allowNull: false,
          comment: 'Título de la tarea por idioma: { "es": "...", "ca": "...", "en": "..." }'
        },
        { transaction }
      ).catch(() => {
        // Ignorar si ya está configurado correctamente
      });
    }

    if (currentTasksDesc.description) {
      await queryInterface.changeColumn(
        'tasks',
        'description',
        {
          type: Sequelize.TEXT('long'),
          allowNull: true,
          comment: 'Descripción de la tarea por idioma: { "es": "...", "ca": "...", "en": "..." }'
        },
        { transaction }
      ).catch(() => {
        // Ignorar si ya está configurado correctamente
      });
    }

    if (currentTasksDesc.intro_html) {
      await queryInterface.changeColumn(
        'tasks',
        'intro_html',
        {
          type: Sequelize.TEXT('long'),
          allowNull: true,
          comment: 'Contenido HTML de introducción por idioma: { "es": "...", "ca": "...", "en": "..." }'
        },
        { transaction }
      ).catch(() => {
        // Ignorar si ya está configurado correctamente
      });
    }

    // 3. Migrar campos de phases
    console.log('Migrando campos de phases...');
    
    // Verificar si las columnas temporales ya existen
    const phasesTableDesc = await queryInterface.describeTable('phases', { transaction }).catch(() => ({}));
    
    // Crear columnas temporales solo si no existen
    if (!phasesTableDesc.name_json) {
      await queryInterface.addColumn(
        'phases',
        'name_json',
        {
          type: Sequelize.JSON,
          allowNull: true
        },
        { transaction }
      );
    }

    if (!phasesTableDesc.description_json) {
      await queryInterface.addColumn(
        'phases',
        'description_json',
        {
          type: Sequelize.TEXT('long'),
          allowNull: true
        },
        { transaction }
      );
    }

    if (!phasesTableDesc.intro_html_json) {
      await queryInterface.addColumn(
        'phases',
        'intro_html_json',
        {
          type: Sequelize.TEXT('long'),
          allowNull: true
        },
        { transaction }
      );
    }

    // Convertir datos existentes a JSON solo si las columnas originales existen
    if (phasesTableDesc.name && phasesTableDesc.name.type !== 'json' && phasesTableDesc.name_json) {
      await queryInterface.sequelize.query(
        `UPDATE phases 
         SET name_json = JSON_OBJECT('es', name)
         WHERE name IS NOT NULL`,
        { transaction }
      ).catch(() => {
        // Ignorar errores si no hay datos o la columna no existe
      });
    }
    
    if (phasesTableDesc.description && phasesTableDesc.description.type !== 'text' && phasesTableDesc.description_json) {
      await queryInterface.sequelize.query(
        `UPDATE phases 
         SET description_json = CASE 
           WHEN description IS NULL THEN NULL 
           ELSE JSON_OBJECT('es', description) 
         END`,
        { transaction }
      ).catch(() => {
        // Ignorar errores si no hay datos o la columna no existe
      });
    }
    
    if (phasesTableDesc.intro_html && phasesTableDesc.intro_html.type !== 'text' && phasesTableDesc.intro_html_json) {
      await queryInterface.sequelize.query(
        `UPDATE phases 
         SET intro_html_json = CASE 
           WHEN intro_html IS NULL THEN NULL 
           ELSE JSON_OBJECT('es', intro_html) 
         END`,
        { transaction }
      ).catch(() => {
        // Ignorar errores si no hay datos o la columna no existe
      });
    }

    // Obtener descripción actualizada después de los cambios
    let currentPhasesDesc = await queryInterface.describeTable('phases', { transaction }).catch(() => ({}));

    // Eliminar columnas antiguas solo si existen y no son JSON
    if (currentPhasesDesc.name && currentPhasesDesc.name.type !== 'json' && currentPhasesDesc.name_json) {
      await queryInterface.removeColumn('phases', 'name', { transaction });
      currentPhasesDesc = await queryInterface.describeTable('phases', { transaction }).catch(() => ({}));
    }
    if (currentPhasesDesc.description && currentPhasesDesc.description.type !== 'text' && currentPhasesDesc.description_json) {
      await queryInterface.removeColumn('phases', 'description', { transaction });
      currentPhasesDesc = await queryInterface.describeTable('phases', { transaction }).catch(() => ({}));
    }
    if (currentPhasesDesc.intro_html && currentPhasesDesc.intro_html.type !== 'text' && currentPhasesDesc.intro_html_json) {
      await queryInterface.removeColumn('phases', 'intro_html', { transaction });
      currentPhasesDesc = await queryInterface.describeTable('phases', { transaction }).catch(() => ({}));
    }

    // Renombrar columnas nuevas solo si existen las columnas temporales y no existe la final
    if (currentPhasesDesc.name_json && !currentPhasesDesc.name) {
      await queryInterface.renameColumn('phases', 'name_json', 'name', { transaction });
      currentPhasesDesc = await queryInterface.describeTable('phases', { transaction }).catch(() => ({}));
    }
    if (currentPhasesDesc.description_json && !currentPhasesDesc.description) {
      await queryInterface.renameColumn('phases', 'description_json', 'description', { transaction });
      currentPhasesDesc = await queryInterface.describeTable('phases', { transaction }).catch(() => ({}));
    }
    if (currentPhasesDesc.intro_html_json && !currentPhasesDesc.intro_html) {
      await queryInterface.renameColumn('phases', 'intro_html_json', 'intro_html', { transaction });
      currentPhasesDesc = await queryInterface.describeTable('phases', { transaction }).catch(() => ({}));
    }

    // Establecer constraints y comentarios solo si las columnas existen
    if (currentPhasesDesc.name) {
      await queryInterface.changeColumn(
        'phases',
        'name',
        {
          type: Sequelize.JSON,
          allowNull: false,
          comment: 'Nombre de la fase por idioma: { "es": "...", "ca": "...", "en": "..." }'
        },
        { transaction }
      ).catch(() => {
        // Ignorar si ya está configurado correctamente
      });
    }

    if (currentPhasesDesc.description) {
      await queryInterface.changeColumn(
        'phases',
        'description',
        {
          type: Sequelize.TEXT('long'),
          allowNull: true,
          comment: 'Descripción de la fase por idioma: { "es": "...", "ca": "...", "en": "..." }'
        },
        { transaction }
      ).catch(() => {
        // Ignorar si ya está configurado correctamente
      });
    }

    if (currentPhasesDesc.intro_html) {
      await queryInterface.changeColumn(
        'phases',
        'intro_html',
        {
          type: Sequelize.TEXT('long'),
          allowNull: true,
          comment: 'Contenido HTML de introducción por idioma: { "es": "...", "ca": "...", "en": "..." }'
        },
        { transaction }
      ).catch(() => {
        // Ignorar si ya está configurado correctamente
      });
    }

    await transaction.commit();
    console.log('Migración completada exitosamente');
  } catch (error) {
    await transaction.rollback();
    console.error('Error en migración:', error);
    throw error;
  }
}

export async function down(queryInterface, Sequelize) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    // Revertir cambios: extraer el valor en español y convertir a string
    console.log('Revirtiendo migración...');

    // 1. Revertir events
    await queryInterface.sequelize.query(
      `UPDATE events 
       SET name = JSON_UNQUOTE(JSON_EXTRACT(name, '$.es')),
           description = CASE 
             WHEN description IS NULL THEN NULL 
             ELSE JSON_UNQUOTE(JSON_EXTRACT(description, '$.es')) 
           END,
           description_html = CASE 
             WHEN description_html IS NULL THEN NULL 
             ELSE JSON_UNQUOTE(JSON_EXTRACT(description_html, '$.es')) 
           END`,
      { transaction }
    );

    await queryInterface.changeColumn(
      'events',
      'name',
      {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      { transaction }
    );

    await queryInterface.changeColumn(
      'events',
      'description',
      {
        type: Sequelize.TEXT,
        allowNull: true
      },
      { transaction }
    );

    await queryInterface.changeColumn(
      'events',
      'description_html',
      {
        type: Sequelize.TEXT,
        allowNull: true
      },
      { transaction }
    );

    // 2. Revertir tasks
    await queryInterface.sequelize.query(
      `UPDATE tasks 
       SET title = JSON_UNQUOTE(JSON_EXTRACT(title, '$.es')),
           description = CASE 
             WHEN description IS NULL THEN NULL 
             ELSE JSON_UNQUOTE(JSON_EXTRACT(description, '$.es')) 
           END,
           intro_html = CASE 
             WHEN intro_html IS NULL THEN NULL 
             ELSE JSON_UNQUOTE(JSON_EXTRACT(intro_html, '$.es')) 
           END`,
      { transaction }
    );

    await queryInterface.changeColumn(
      'tasks',
      'title',
      {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      { transaction }
    );

    await queryInterface.changeColumn(
      'tasks',
      'description',
      {
        type: Sequelize.TEXT,
        allowNull: true
      },
      { transaction }
    );

    await queryInterface.changeColumn(
      'tasks',
      'intro_html',
      {
        type: Sequelize.TEXT('long'),
        allowNull: true
      },
      { transaction }
    );

    // 3. Revertir phases
    await queryInterface.sequelize.query(
      `UPDATE phases 
       SET name = JSON_UNQUOTE(JSON_EXTRACT(name, '$.es')),
           description = CASE 
             WHEN description IS NULL THEN NULL 
             ELSE JSON_UNQUOTE(JSON_EXTRACT(description, '$.es')) 
           END,
           intro_html = CASE 
             WHEN intro_html IS NULL THEN NULL 
             ELSE JSON_UNQUOTE(JSON_EXTRACT(intro_html, '$.es')) 
           END`,
      { transaction }
    );

    await queryInterface.changeColumn(
      'phases',
      'name',
      {
        type: Sequelize.STRING(200),
        allowNull: false
      },
      { transaction }
    );

    await queryInterface.changeColumn(
      'phases',
      'description',
      {
        type: Sequelize.TEXT,
        allowNull: true
      },
      { transaction }
    );

    await queryInterface.changeColumn(
      'phases',
      'intro_html',
      {
        type: Sequelize.TEXT('long'),
        allowNull: true
      },
      { transaction }
    );

    await transaction.commit();
    console.log('Reversión completada exitosamente');
  } catch (error) {
    await transaction.rollback();
    console.error('Error en reversión:', error);
    throw error;
  }
}

