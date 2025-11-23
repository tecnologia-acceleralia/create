// Seeder maestro para establecer el prompt por defecto de evaluación con IA para los eventos de UIC.
// El prompt se almacena como texto plano en un solo idioma (español). El idioma de respuesta se indica al ejecutar el prompt.
// Dependencias: 0002-uic-tenant.js (debe ejecutarse después de crear el tenant y eventos).
// IMPORTANTE: Este seeder es idempotente y verifica la existencia de las columnas antes de usarlas.

export async function up(queryInterface) {
  const [[tenant]] = await queryInterface.sequelize.query(
    "SELECT id FROM tenants WHERE slug = 'uic' LIMIT 1"
  );

  if (!tenant) {
    throw new Error('No se encontró el tenant UIC. Ejecuta primero el seeder 0002-uic-tenant.js');
  }

  // Verificar que las columnas necesarias existen (deben existir después de las migraciones 0013 y 0014)
  const tableDescription = await queryInterface.describeTable('events').catch(() => null);
  
  if (!tableDescription) {
    throw new Error('La tabla events no existe. Ejecuta primero las migraciones.');
  }

  if (!tableDescription.ai_evaluation_prompt) {
    console.log('⚠ La columna ai_evaluation_prompt no existe en la tabla events. Este seeder requiere la migración 0013-add-ai-evaluation-prompt-to-events.js');
    console.log('⚠ Omitiendo este seeder. Los eventos se crearán sin prompt de IA hasta que se ejecute la migración correspondiente.');
    return;
  }

  // Prompt por defecto de evaluación con IA (texto plano en español)
  // Nota: El prompt se almacena como texto plano. El idioma de respuesta se indica dentro del prompt.
  const defaultPrompt = `Eres un asistente evaluador de proyectos de emprendimiento para alumnado de formación.

Tu tarea es **evaluar proyectos entregados por el alumnado** siguiendo EXCLUSIVAMENTE la rúbrica proporcionada.

INSTRUCCIONES DE EVALUACIÓN
---------------------------

1. Lee atentamente la información del proyecto que te proporcione el usuario. Puede incluir:
   - Descripción general del proyecto.
   - Modelo de negocio.
   - Impacto social.
   - Documentación entregada (memoria, presentaciones, etc.).
   - Información sobre el equipo.

2. Recorre TODOS los criterios definidos en la rúbrica. Para cada criterio:
   - Ten en cuenta su descripción para entender qué aspecto del proyecto evalúa.
   - Compara el contenido del proyecto con los niveles posibles de ese criterio.
   - Selecciona un score dentro del rango permitido (según scaleMin, scaleMax o maxScore del criterio), eligiendo el nivel que mejor se ajuste al proyecto.
   - Identifica, de forma breve:
       - 1–3 fortalezas relacionadas con ese criterio (si las hay).
       - 1–3 aspectos de mejora concretos (si procede).

3. Cálculo de la nota global:
   - La nota global se calcula como la **media ponderada** de los criterios:
       - \`nota_global = SUMATORIO(score_criterio * peso_porcentaje/100)\`.
   - Las puntuaciones deben respetar el rango definido por la rúbrica (scaleMin, scaleMax o maxScore por criterio si está presente).
   - No redondees hasta el final. Al mostrar las notas, puedes usar 2 decimales.

4. Manejo de información insuficiente:
   - Si para algún criterio la información del proyecto es claramente insuficiente:
       - Asigna el nivel que mejor se ajuste, pero deja claro en la justificación que la información es limitada.
       - Si realmente no puedes evaluar, indica \`score: null\` y explícalo en la justificación.
   - Nunca inventes datos que el proyecto no proporcione.

5. Tono y estilo:
   - Usa un tono **pedagógico, claro y constructivo**.
   - Dirígete al profesorado, no al alumnado directamente (por ejemplo: "El proyecto presenta…", "Se observa que…").
   - Sé concreto: evita frases vacías tipo "podría mejorar en algunos aspectos" sin decir cuáles.

FORMATO DE RESPUESTA
--------------------

Responde SIEMPRE **solo** con un JSON válido (sin texto adicional fuera del JSON), con esta estructura:

{
  "resumen": {
    "nombre_rubrica": "<texto>",
    "nota_global": <número>,
    "comentario_global": "<comentario general de máximo 8-10 líneas, resumiendo puntos fuertes y principales áreas de mejora del proyecto>"
  },
  "criterios": [
    {
      "criterionId": <número, id del criterio>,
      "nombre": "<nombre legible del criterio>",
      "peso_porcentaje": <número>,
      "score": <número dentro del rango permitido o null si no se puede evaluar>,
      "justificacion": "<explicación breve de por qué has asignado ese nivel, máximo 4-6 líneas>",
      "fortalezas": [
        "<fortaleza 1 relacionada con este criterio>",
        "<fortaleza 2 (opcional)>",
        "<fortaleza 3 (opcional)>"
      ],
      "mejoras": [
        "<mejora concreta 1 relacionada con este criterio>",
        "<mejora concreta 2 (opcional)>",
        "<mejora concreta 3 (opcional)>"
      ]
    }
    // ... repetir un objeto por cada criterio de la rúbrica en el mismo orden en el que aparecen
  ]
}

REGLAS IMPORTANTES
------------------

- Usa SIEMPRE los criterios, pesos y niveles del archivo de rúbrica proporcionado.
- No modifiques ni inventes nuevos criterios o pesos.
- No des consejos genéricos que no estén vinculados al contenido concreto del proyecto.
- No salgas nunca del formato JSON especificado.
- Si el usuario no proporciona ningún contenido de proyecto, responde con \`nota_global = null\` y justifica en cada criterio que no hay información suficiente para evaluar.
- Idioma requerido para la respuesta: español.`;

  // Actualizar todos los eventos del tenant UIC que no tengan ya un prompt configurado
  const [events] = await queryInterface.sequelize.query(
    `SELECT id, name FROM events WHERE tenant_id = ${tenant.id}`
  );

  if (events.length === 0) {
    console.log('No se encontraron eventos para el tenant UIC.');
    return;
  }

  let updatedCount = 0;
  for (const event of events) {
    // Solo actualizar si el evento no tiene ya un prompt configurado
    const [existing] = await queryInterface.sequelize.query(
      `SELECT ai_evaluation_prompt FROM events WHERE id = ${event.id} LIMIT 1`
    );

    // Verificar si el prompt está NULL, undefined o es una cadena vacía
    const hasPrompt = existing && existing[0] && existing[0].ai_evaluation_prompt && 
                      existing[0].ai_evaluation_prompt.trim().length > 0;

    if (!hasPrompt) {
      await queryInterface.sequelize.query(
        `UPDATE events SET ai_evaluation_prompt = :prompt, updated_at = NOW() WHERE id = :eventId`,
        {
          replacements: {
            prompt: defaultPrompt,
            eventId: event.id
          }
        }
      );
      updatedCount++;
      // Manejar el nombre del evento que puede ser JSON o string
      const eventName = typeof event.name === 'object' && event.name !== null 
        ? (event.name.es || event.name.ca || event.name.en || JSON.stringify(event.name))
        : (event.name || `Evento ID ${event.id}`);
      console.log(`Prompt de evaluación con IA establecido para el evento: ${eventName} (ID: ${event.id})`);
    } else {
      // Manejar el nombre del evento que puede ser JSON o string
      const eventName = typeof event.name === 'object' && event.name !== null 
        ? (event.name.es || event.name.ca || event.name.en || JSON.stringify(event.name))
        : (event.name || `Evento ID ${event.id}`);
      console.log(`El evento "${eventName}" (ID: ${event.id}) ya tiene un prompt configurado, omitiendo...`);
    }
  }

  // Establecer también los parámetros de OpenAI por defecto (si las columnas existen)
  const hasOpenAIColumns = tableDescription.ai_evaluation_model !== undefined;
  
  for (const event of events) {
    const updateFields = [];
    const replacements = { eventId: event.id };

    // Solo intentar actualizar columnas de OpenAI si existen (migración 0014)
    if (hasOpenAIColumns) {
      // Modelo por defecto: gpt-4o-mini
      const [modelCheck] = await queryInterface.sequelize.query(
        `SELECT ai_evaluation_model FROM events WHERE id = ${event.id} LIMIT 1`
      );
      if (modelCheck && modelCheck[0] && !modelCheck[0].ai_evaluation_model) {
        updateFields.push('ai_evaluation_model = :model');
        replacements.model = 'gpt-4o-mini';
      }

      // Temperatura por defecto: 0.2
      const [tempCheck] = await queryInterface.sequelize.query(
        `SELECT ai_evaluation_temperature FROM events WHERE id = ${event.id} LIMIT 1`
      );
      if (tempCheck && tempCheck[0] && (tempCheck[0].ai_evaluation_temperature === null || tempCheck[0].ai_evaluation_temperature === undefined)) {
        updateFields.push('ai_evaluation_temperature = :temperature');
        replacements.temperature = 0.2;
      }

      // Max tokens por defecto: 1200
      const [maxTokensCheck] = await queryInterface.sequelize.query(
        `SELECT ai_evaluation_max_tokens FROM events WHERE id = ${event.id} LIMIT 1`
      );
      if (maxTokensCheck && maxTokensCheck[0] && !maxTokensCheck[0].ai_evaluation_max_tokens) {
        updateFields.push('ai_evaluation_max_tokens = :maxTokens');
        replacements.maxTokens = 1200;
      }

      // Top-p por defecto: 1.0 (no se establece si ya tiene valor)
      const [topPCheck] = await queryInterface.sequelize.query(
        `SELECT ai_evaluation_top_p FROM events WHERE id = ${event.id} LIMIT 1`
      );
      if (topPCheck && topPCheck[0] && (topPCheck[0].ai_evaluation_top_p === null || topPCheck[0].ai_evaluation_top_p === undefined)) {
        updateFields.push('ai_evaluation_top_p = :topP');
        replacements.topP = 1.0;
      }

      // Frequency penalty por defecto: 0.0 (no se establece si ya tiene valor)
      const [freqPenaltyCheck] = await queryInterface.sequelize.query(
        `SELECT ai_evaluation_frequency_penalty FROM events WHERE id = ${event.id} LIMIT 1`
      );
      if (freqPenaltyCheck && freqPenaltyCheck[0] && (freqPenaltyCheck[0].ai_evaluation_frequency_penalty === null || freqPenaltyCheck[0].ai_evaluation_frequency_penalty === undefined)) {
        updateFields.push('ai_evaluation_frequency_penalty = :frequencyPenalty');
        replacements.frequencyPenalty = 0.0;
      }

      // Presence penalty por defecto: 0.0 (no se establece si ya tiene valor)
      const [presPenaltyCheck] = await queryInterface.sequelize.query(
        `SELECT ai_evaluation_presence_penalty FROM events WHERE id = ${event.id} LIMIT 1`
      );
      if (presPenaltyCheck && presPenaltyCheck[0] && (presPenaltyCheck[0].ai_evaluation_presence_penalty === null || presPenaltyCheck[0].ai_evaluation_presence_penalty === undefined)) {
        updateFields.push('ai_evaluation_presence_penalty = :presencePenalty');
        replacements.presencePenalty = 0.0;
      }
    }

    if (updateFields.length > 0) {
      await queryInterface.sequelize.query(
        `UPDATE events SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = :eventId`,
        { replacements }
      );
      // Manejar el nombre del evento que puede ser JSON o string
      const eventName = typeof event.name === 'object' && event.name !== null 
        ? (event.name.es || event.name.ca || event.name.en || JSON.stringify(event.name))
        : (event.name || `Evento ID ${event.id}`);
      console.log(`Parámetros de OpenAI establecidos para el evento: ${eventName} (ID: ${event.id})`);
    }
  }

  if (updatedCount > 0) {
    console.log(`Se estableció el prompt por defecto de evaluación con IA para ${updatedCount} evento(s) de UIC.`);
  } else {
    console.log('Todos los eventos de UIC ya tienen un prompt configurado o no se encontraron eventos.');
  }
  
  console.log('Configuración de evaluación con IA completada para los eventos de UIC.');
}

export async function down(queryInterface) {
  const [[tenant]] = await queryInterface.sequelize.query(
    "SELECT id FROM tenants WHERE slug = 'uic' LIMIT 1"
  );

  if (!tenant) {
    return;
  }

  // Eliminar la configuración de evaluación con IA de todos los eventos de UIC
  await queryInterface.sequelize.query(
    `UPDATE events SET 
      ai_evaluation_prompt = NULL, 
      ai_evaluation_model = NULL, 
      ai_evaluation_temperature = NULL, 
      ai_evaluation_max_tokens = NULL,
      ai_evaluation_top_p = NULL,
      ai_evaluation_frequency_penalty = NULL,
      ai_evaluation_presence_penalty = NULL,
      updated_at = NOW() 
    WHERE tenant_id = :tenantId`,
    {
      replacements: {
        tenantId: tenant.id
      }
    }
  );

  console.log('Se eliminó la configuración de evaluación con IA de los eventos de UIC.');
}

