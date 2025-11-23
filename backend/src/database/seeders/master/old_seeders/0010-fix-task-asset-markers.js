/**
 * Seeder que corrige los marcadores de assets incorrectos en el HTML de las tareas.
 * 
 * Dependencias: requiere que las tareas existan (0002-uic-tenant.js).
 * 
 * Este seeder actualiza los marcadores de assets en el campo intro_html de las tareas
 * para usar los nombres de archivo correctos que existen en S3.
 */

export async function up(queryInterface) {
  // Mapeo de marcadores incorrectos a correctos
  const markerReplacements = [
    {
      incorrect: '{{asset:10-pasos-para-hacer-un-analisis-de-sector.pdf}}',
      correct: '{{asset:pasos-para-hacer-un-analisis-de-sector.pdf}}'
    },
    {
      incorrect: '{{asset:Como-definir-la-mision-vision-y-valores-de-una-empresa-ejemplos.pdf}}',
      correct: '{{asset:Como-definir-la-misio-vision-y-valores-de-una-empresa-ejemplos.pdf}}'
    },
    {
      incorrect: '{{asset:Que-es-y-para-que-sirve-un-diagrama-de-Gantt_.pdf}}',
      correct: '{{asset:Que-es-y-para-que-sirve-un-diagrama-de-Gantt.pdf}}'
    }
  ];

  let totalUpdated = 0;

  // Procesar cada reemplazo
  for (const replacement of markerReplacements) {
    // Buscar tareas que contengan el marcador incorrecto
    const [tasks] = await queryInterface.sequelize.query(
      `SELECT id, title, intro_html FROM tasks WHERE intro_html LIKE :pattern`,
      {
        replacements: {
          pattern: `%${replacement.incorrect}%`
        }
      }
    );

    if (tasks.length === 0) {
      console.log(`⚠ No se encontraron tareas con el marcador: ${replacement.incorrect}`);
      continue;
    }

    // Actualizar cada tarea
    for (const task of tasks) {
      const updatedHtml = task.intro_html.replace(
        replacement.incorrect,
        replacement.correct
      );

      await queryInterface.sequelize.query(
        `UPDATE tasks SET intro_html = :html, updated_at = :updatedAt WHERE id = :taskId`,
        {
          replacements: {
            html: updatedHtml,
            taskId: task.id,
            updatedAt: new Date()
          }
        }
      );

      console.log(`✓ Tarea "${task.title}" (ID: ${task.id}): ${replacement.incorrect} → ${replacement.correct}`);
      totalUpdated++;
    }
  }

  console.log(`\n✓ Total de tareas actualizadas: ${totalUpdated}`);
}

export async function down(queryInterface) {
  // Mapeo inverso: marcadores correctos a incorrectos (para revertir)
  const markerReplacements = [
    {
      correct: '{{asset:pasos-para-hacer-un-analisis-de-sector.pdf}}',
      incorrect: '{{asset:10-pasos-para-hacer-un-analisis-de-sector.pdf}}'
    },
    {
      correct: '{{asset:Como-definir-la-misio-vision-y-valores-de-una-empresa-ejemplos.pdf}}',
      incorrect: '{{asset:Como-definir-la-mision-vision-y-valores-de-una-empresa-ejemplos.pdf}}'
    },
    {
      correct: '{{asset:Que-es-y-para-que-sirve-un-diagrama-de-Gantt.pdf}}',
      incorrect: '{{asset:Que-es-y-para-que-sirve-un-diagrama-de-Gantt_.pdf}}'
    }
  ];

  let totalReverted = 0;

  // Procesar cada reemplazo inverso
  for (const replacement of markerReplacements) {
    // Buscar tareas que contengan el marcador correcto
    const [tasks] = await queryInterface.sequelize.query(
      `SELECT id, title, intro_html FROM tasks WHERE intro_html LIKE :pattern`,
      {
        replacements: {
          pattern: `%${replacement.correct}%`
        }
      }
    );

    if (tasks.length === 0) {
      console.log(`⚠ No se encontraron tareas con el marcador: ${replacement.correct}`);
      continue;
    }

    // Revertir cada tarea
    for (const task of tasks) {
      const revertedHtml = task.intro_html.replace(
        replacement.correct,
        replacement.incorrect
      );

      await queryInterface.sequelize.query(
        `UPDATE tasks SET intro_html = :html, updated_at = :updatedAt WHERE id = :taskId`,
        {
          replacements: {
            html: revertedHtml,
            taskId: task.id,
            updatedAt: new Date()
          }
        }
      );

      console.log(`✓ Tarea "${task.title}" (ID: ${task.id}): ${replacement.correct} → ${replacement.incorrect} (revertido)`);
      totalReverted++;
    }
  }

  console.log(`\n✓ Total de tareas revertidas: ${totalReverted}`);
}

