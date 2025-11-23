import OpenAI from 'openai';
import { logger } from '../utils/logger.js';

let cachedClient = null;
let clientOverride = null;

export function __setOpenAiClient(client) {
  clientOverride = client ?? null;
  cachedClient = client ?? null;
}

function ensureClient() {
  if (clientOverride) {
    return clientOverride;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY no está configurado');
  }

  if (!cachedClient) {
    cachedClient = new OpenAI({ apiKey });
  }

  return cachedClient;
}

function buildRubricSnapshot(rubric) {
  return {
    id: rubric.id,
    name: rubric.name,
    description: rubric.description,
    scaleMin: rubric.scale_min ?? rubric.scaleMin ?? 0,
    scaleMax: rubric.scale_max ?? rubric.scaleMax ?? 100,
    criteria: (rubric.criteria ?? []).map(criterion => ({
      id: criterion.id,
      title: criterion.title,
      description: criterion.description,
      weight: Number(criterion.weight ?? 1),
      maxScore: criterion.max_score ? Number(criterion.max_score) : null
    }))
  };
}

function buildEvaluationPrompt({ rubricSnapshot, submission, task, locale, customPrompt }) {
  const localeMap = {
    'es-ES': 'español',
    'ca-ES': 'catalán',
    'en-US': 'inglés',
    'en': 'inglés',
    'ca': 'catalán',
    'es': 'español'
  };
  const language = localeMap[locale] || localeMap[locale?.split('-')[0]] || 'español';

  // Si hay un prompt personalizado, usarlo directamente
  if (customPrompt && typeof customPrompt === 'string' && customPrompt.trim()) {
    const criteriaDescription = rubricSnapshot.criteria
      .map(
        (criterion, index) => {
          const pesoPorcentaje = criterion.weight;
          const maxScore = criterion.maxScore ? ` (puntuación máxima: ${criterion.maxScore})` : '';
          return `${index + 1}. ${criterion.title} (peso: ${pesoPorcentaje}%${maxScore})
   Descripción: ${criterion.description || 'Sin descripción adicional'}`;
        }
      )
      .join('\n\n');

    const submissionContent = [
      task?.title ? `Tarea: ${task.title}` : null,
      task?.description ? `Descripción de la tarea: ${task.description}` : null,
      `Contenido enviado:\n${submission.content ?? 'Sin texto proporcionado'}`,
      submission.files?.length
        ? `Archivos adjuntos:\n${submission.files
          .map(file => `* ${file.original_name ?? file.url} (${file.mime_type}, ${file.size_bytes} bytes) -> ${file.url}`)
          .join('\n')}`
        : 'Sin archivos adjuntos.'
    ]
      .filter(Boolean)
      .join('\n\n');

    return `${customPrompt.trim()}

RÚBRICA DE EVALUACIÓN
---------------------
Nombre: ${rubricSnapshot.name}
${rubricSnapshot.description ? `Descripción: ${rubricSnapshot.description}\n` : ''}Escala global: ${rubricSnapshot.scaleMin} - ${rubricSnapshot.scaleMax}

Criterios:
${criteriaDescription}

ENTREGA A EVALUAR
-----------------
${submissionContent}

IDIOMA REQUERIDO
----------------
Idioma requerido para la respuesta: ${language}.`;
  }

  // Prompt por defecto
  const instructions = [
    'Eres un asistente evaluador de proyectos de emprendimiento para alumnado de formación.',
    '',
    'Tu tarea es **evaluar proyectos entregados por el alumnado** siguiendo EXCLUSIVAMENTE la rúbrica proporcionada.',
    '',
    'INSTRUCCIONES DE EVALUACIÓN',
    '---------------------------',
    '',
    '1. Lee atentamente la información del proyecto que te proporcione el usuario. Puede incluir:',
    '   - Descripción general del proyecto.',
    '   - Modelo de negocio.',
    '   - Impacto social.',
    '   - Documentación entregada (memoria, presentaciones, etc.).',
    '   - Información sobre el equipo.',
    '',
    '2. Recorre TODOS los criterios definidos en la rúbrica. Para cada criterio:',
    '   - Ten en cuenta su descripción para entender qué aspecto del proyecto evalúa.',
    '   - Compara el contenido del proyecto con los niveles posibles de ese criterio.',
    '   - Selecciona un score dentro del rango permitido (según scaleMin, scaleMax o maxScore del criterio), eligiendo el nivel que mejor se ajuste al proyecto.',
    '   - Identifica, de forma breve:',
    '       - 1–3 fortalezas relacionadas con ese criterio (si las hay).',
    '       - 1–3 aspectos de mejora concretos (si procede).',
    '',
    '3. Cálculo de la nota global:',
    '   - La nota global se calcula como la **media ponderada** de los criterios:',
    '       - `nota_global = SUMATORIO(score_criterio * peso_porcentaje/100)`.',
    '   - Las puntuaciones deben respetar el rango definido por la rúbrica (scaleMin, scaleMax o maxScore por criterio si está presente).',
    '   - No redondees hasta el final. Al mostrar las notas, puedes usar 2 decimales.',
    '',
    '4. Manejo de información insuficiente:',
    '   - Si para algún criterio la información del proyecto es claramente insuficiente:',
    '       - Asigna el nivel que mejor se ajuste, pero deja claro en la justificación que la información es limitada.',
    '       - Si realmente no puedes evaluar, indica `score: null` y explícalo en la justificación.',
    '   - Nunca inventes datos que el proyecto no proporcione.',
    '',
    '5. Tono y estilo:',
    '   - Usa un tono **pedagógico, claro y constructivo**.',
    '   - Dirígete al profesorado, no al alumnado directamente (por ejemplo: "El proyecto presenta…", "Se observa que…").',
    '   - Sé concreto: evita frases vacías tipo "podría mejorar en algunos aspectos" sin decir cuáles.',
    '',
    'FORMATO DE RESPUESTA',
    '--------------------',
    '',
    'Responde SIEMPRE **solo** con un JSON válido (sin texto adicional fuera del JSON), con esta estructura:',
    '',
    '{',
    '  "resumen": {',
    '    "nombre_rubrica": "<texto>",',
    '    "nota_global": <número>,',
    '    "comentario_global": "<comentario general de máximo 8-10 líneas, resumiendo puntos fuertes y principales áreas de mejora del proyecto>"',
    '  },',
    '  "criterios": [',
    '    {',
    '      "criterionId": <número, id del criterio>,',
    '      "nombre": "<nombre legible del criterio>",',
    '      "peso_porcentaje": <número>,',
    '      "score": <número dentro del rango permitido o null si no se puede evaluar>,',
    '      "justificacion": "<explicación breve de por qué has asignado ese nivel, máximo 4-6 líneas>",',
    '      "fortalezas": [',
    '        "<fortaleza 1 relacionada con este criterio>",',
    '        "<fortaleza 2 (opcional)>",',
    '        "<fortaleza 3 (opcional)>"',
    '      ],',
    '      "mejoras": [',
    '        "<mejora concreta 1 relacionada con este criterio>",',
    '        "<mejora concreta 2 (opcional)>",',
    '        "<mejora concreta 3 (opcional)>"',
    '      ]',
    '    }',
    '    // ... repetir un objeto por cada criterio de la rúbrica en el mismo orden en el que aparecen',
    '  ]',
    '}',
    '',
    'REGLAS IMPORTANTES',
    '------------------',
    '',
    '- Usa SIEMPRE los criterios, pesos y niveles del archivo de rúbrica proporcionado.',
    '- No modifiques ni inventes nuevos criterios o pesos.',
    '- No des consejos genéricos que no estén vinculados al contenido concreto del proyecto.',
    '- No salgas nunca del formato JSON especificado.',
    '- Si el usuario no proporciona ningún contenido de proyecto, responde con `nota_global = null` y justifica en cada criterio que no hay información suficiente para evaluar.',
    `- Idioma requerido para la respuesta: ${language}.`
  ].join('\n');

  const criteriaDescription = rubricSnapshot.criteria
    .map(
      (criterion, index) => {
        const pesoPorcentaje = criterion.weight;
        const maxScore = criterion.maxScore ? ` (puntuación máxima: ${criterion.maxScore})` : '';
        return `${index + 1}. ${criterion.title} (peso: ${pesoPorcentaje}%${maxScore})
   Descripción: ${criterion.description || 'Sin descripción adicional'}`;
      }
    )
    .join('\n\n');

  const submissionContent = [
    task?.title ? `Tarea: ${task.title}` : null,
    task?.description ? `Descripción de la tarea: ${task.description}` : null,
    `Contenido enviado:\n${submission.content ?? 'Sin texto proporcionado'}`,
    submission.files?.length
      ? `Archivos adjuntos:\n${submission.files
        .map(file => `* ${file.original_name ?? file.url} (${file.mime_type}, ${file.size_bytes} bytes) -> ${file.url}`)
        .join('\n')}`
      : 'Sin archivos adjuntos.'
  ]
    .filter(Boolean)
    .join('\n\n');

  return `${instructions}

RÚBRICA DE EVALUACIÓN
---------------------
Nombre: ${rubricSnapshot.name}
${rubricSnapshot.description ? `Descripción: ${rubricSnapshot.description}\n` : ''}Escala global: ${rubricSnapshot.scaleMin} - ${rubricSnapshot.scaleMax}

Criterios:
${criteriaDescription}

ENTREGA A EVALUAR
-----------------
${submissionContent}`;
}

export async function generateAiEvaluation({ rubric, submission, task, locale, customPrompt, aiConfig }) {
  const client = ensureClient();
  const rubricSnapshot = buildRubricSnapshot(rubric);
  
  // Usar configuración del evento si está disponible, sino usar valores por defecto
  const model = aiConfig?.model || process.env.OPENAI_EVALUATION_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const temperature = aiConfig?.temperature !== null && aiConfig?.temperature !== undefined 
    ? Number(aiConfig.temperature) 
    : 0.2;
  const maxTokens = aiConfig?.max_tokens || null;
  const topP = aiConfig?.top_p !== null && aiConfig?.top_p !== undefined ? Number(aiConfig.top_p) : null;
  const frequencyPenalty = aiConfig?.frequency_penalty !== null && aiConfig?.frequency_penalty !== undefined 
    ? Number(aiConfig.frequency_penalty) 
    : null;
  const presencePenalty = aiConfig?.presence_penalty !== null && aiConfig?.presence_penalty !== undefined 
    ? Number(aiConfig.presence_penalty) 
    : null;

  const prompt = buildEvaluationPrompt({
    rubricSnapshot,
    submission,
    task,
    locale: locale ?? 'es-ES',
    customPrompt
  });

  const requestOptions = {
    model,
    temperature,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: 'Eres un asistente evaluador de proyectos de emprendimiento para alumnado de formación. Aplicas rúbricas objetivas con un enfoque pedagógico, claro y constructivo.'
      },
      {
        role: 'user',
        content: prompt
      }
    ]
  };

  // Solo añadir parámetros opcionales si están configurados
  if (maxTokens && maxTokens > 0) {
    requestOptions.max_tokens = Math.floor(maxTokens);
  }
  if (topP !== null && topP !== undefined) {
    requestOptions.top_p = topP;
  }
  if (frequencyPenalty !== null && frequencyPenalty !== undefined) {
    requestOptions.frequency_penalty = frequencyPenalty;
  }
  if (presencePenalty !== null && presencePenalty !== undefined) {
    requestOptions.presence_penalty = presencePenalty;
  }

  const response = await client.chat.completions.create(requestOptions);

  const messageContent = response.choices?.[0]?.message?.content;
  if (!messageContent) {
    throw new Error('La respuesta de OpenAI no contiene contenido');
  }

  let parsed;
  try {
    parsed = JSON.parse(messageContent);
  } catch (error) {
    logger.error('No se pudo parsear la respuesta de OpenAI', {
      error: error.message,
      raw: messageContent
    });
    throw new Error('La respuesta de OpenAI no es JSON válido');
  }

  // Manejar tanto el formato nuevo (con resumen) como el formato antiguo (compatibilidad)
  let overallScore = null;
  let overallFeedback = '';

  if (parsed.resumen) {
    // Formato nuevo mejorado
    overallScore = parsed.resumen.nota_global ?? null;
    overallFeedback = parsed.resumen.comentario_global ?? '';
  } else {
    // Formato antiguo (compatibilidad hacia atrás)
    overallScore = parsed.overallScore ?? null;
    overallFeedback = parsed.overallFeedback ?? '';
  }

  // Procesar criterios: el formato nuevo incluye fortalezas y mejoras
  const criteria = Array.isArray(parsed.criterios) 
    ? parsed.criterios.map(c => ({
        criterionId: c.criterionId ?? c.id ?? null,
        score: c.score ?? null,
        feedback: c.justificacion ?? c.feedback ?? '',
        fortalezas: Array.isArray(c.fortalezas) ? c.fortalezas : [],
        mejoras: Array.isArray(c.mejoras) ? c.mejoras : [],
        nombre: c.nombre ?? null,
        peso_porcentaje: c.peso_porcentaje ?? null
      }))
    : Array.isArray(parsed.criteria)
      ? parsed.criteria.map(c => ({
          criterionId: c.criterionId ?? c.id ?? null,
          score: c.score ?? null,
          feedback: c.feedback ?? '',
          fortalezas: [],
          mejoras: [],
          nombre: null,
          peso_porcentaje: null
        }))
      : [];

  return {
    rubricSnapshot,
    overallScore,
    overallFeedback,
    criteria,
    raw: parsed,
    usage: response.usage
  };
}

function buildMultiSubmissionPrompt({ rubricSnapshot, submissions, tasks, locale }) {
  const localeMap = {
    'es-ES': 'español',
    'ca-ES': 'catalán',
    'en-US': 'inglés',
    'en': 'inglés',
    'ca': 'catalán',
    'es': 'español'
  };
  const language = localeMap[locale] || localeMap[locale?.split('-')[0]] || 'español';

  const instructions = [
    'Eres un asistente evaluador de proyectos de emprendimiento para alumnado de formación.',
    '',
    'Tu tarea es **evaluar múltiples entregas de un proyecto** como un conjunto coherente, siguiendo EXCLUSIVAMENTE la rúbrica proporcionada.',
    '',
    'INSTRUCCIONES DE EVALUACIÓN',
    '---------------------------',
    '',
    '1. Lee atentamente todas las entregas proporcionadas. Evalúa el trabajo completo de la fase/proyecto considerando todas las entregas en conjunto.',
    '',
    '2. Recorre TODOS los criterios definidos en la rúbrica. Para cada criterio:',
    '   - Ten en cuenta su descripción para entender qué aspecto del proyecto evalúa.',
    '   - Compara el contenido de todas las entregas con los niveles posibles de ese criterio.',
    '   - Selecciona un score dentro del rango permitido, eligiendo el nivel que mejor se ajuste al conjunto de entregas.',
    '   - Identifica, de forma breve:',
    '       - 1–3 fortalezas relacionadas con ese criterio (si las hay).',
    '       - 1–3 aspectos de mejora concretos (si procede).',
    '',
    '3. Cálculo de la nota global:',
    '   - La nota global se calcula como la **media ponderada** de los criterios:',
    '       - `nota_global = SUMATORIO(score_criterio * peso_porcentaje/100)`.',
    '   - Las puntuaciones deben respetar el rango definido por la rúbrica (scaleMin, scaleMax o maxScore por criterio si está presente).',
    '',
    '4. Tono y estilo:',
    '   - Usa un tono **pedagógico, claro y constructivo**.',
    '   - Dirígete al profesorado, no al alumnado directamente.',
    '   - Sé concreto: evita frases vacías sin especificar qué mejorar.',
    '',
    'FORMATO DE RESPUESTA',
    '--------------------',
    '',
    'Responde SIEMPRE **solo** con un JSON válido, con esta estructura:',
    '',
    '{',
    '  "resumen": {',
    '    "nombre_rubrica": "<texto>",',
    '    "nota_global": <número>,',
    '    "comentario_global": "<comentario general resumiendo puntos fuertes y principales áreas de mejora>"',
    '  },',
    '  "criterios": [',
    '    {',
    '      "criterionId": <número>,',
    '      "nombre": "<nombre del criterio>",',
    '      "peso_porcentaje": <número>,',
    '      "score": <número o null>,',
    '      "justificacion": "<explicación breve, máximo 4-6 líneas>",',
    '      "fortalezas": ["<fortaleza 1>", "<fortaleza 2 (opcional)>"],',
    '      "mejoras": ["<mejora 1>", "<mejora 2 (opcional)>"]',
    '    }',
    '  ]',
    '}',
    '',
    `- Idioma requerido para la respuesta: ${language}.`
  ].join('\n');

  const criteriaDescription = rubricSnapshot.criteria
    .map(
      (criterion, index) => {
        const pesoPorcentaje = criterion.weight;
        const maxScore = criterion.maxScore ? ` (puntuación máxima: ${criterion.maxScore})` : '';
        return `${index + 1}. ${criterion.title} (peso: ${pesoPorcentaje}%${maxScore})
   Descripción: ${criterion.description || 'Sin descripción adicional'}`;
      }
    )
    .join('\n\n');

  const submissionsContent = submissions
    .map((submission, index) => {
      const task = tasks.find(t => t.id === submission.task_id);
      return `Entrega ${index + 1} - ${task?.title ?? 'Tarea sin título'}: 
${task?.description ? `Descripción: ${task.description}\n` : ''}Contenido: ${submission.content ?? 'Sin texto proporcionado'}
${submission.files?.length
  ? `Archivos:\n${submission.files
    .map(file => `* ${file.original_name ?? file.url} (${file.mime_type}, ${file.size_bytes} bytes) -> ${file.url}`)
    .join('\n')}`
  : 'Sin archivos adjuntos.'}
Fecha de entrega: ${submission.submitted_at ? new Date(submission.submitted_at).toLocaleString(locale ?? 'es-ES') : 'N/A'}
---`;
    })
    .join('\n\n');

  return `${instructions}

RÚBRICA DE EVALUACIÓN
---------------------
Nombre: ${rubricSnapshot.name}
${rubricSnapshot.description ? `Descripción: ${rubricSnapshot.description}\n` : ''}Escala global: ${rubricSnapshot.scaleMin} - ${rubricSnapshot.scaleMax}

Criterios:
${criteriaDescription}

ENTREGAS A EVALUAR (${submissions.length} en total)
---------------------------------------------------
${submissionsContent}`;
}

export async function generateMultiSubmissionAiEvaluation({ rubric, submissions, tasks, locale, aiConfig }) {
  const client = ensureClient();
  const rubricSnapshot = buildRubricSnapshot(rubric);
  
  // Usar configuración del evento si está disponible, sino usar valores por defecto
  const model = aiConfig?.model || process.env.OPENAI_EVALUATION_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const temperature = aiConfig?.temperature !== null && aiConfig?.temperature !== undefined 
    ? Number(aiConfig.temperature) 
    : 0.2;
  const maxTokens = aiConfig?.max_tokens || null;
  const topP = aiConfig?.top_p !== null && aiConfig?.top_p !== undefined ? Number(aiConfig.top_p) : null;
  const frequencyPenalty = aiConfig?.frequency_penalty !== null && aiConfig?.frequency_penalty !== undefined 
    ? Number(aiConfig.frequency_penalty) 
    : null;
  const presencePenalty = aiConfig?.presence_penalty !== null && aiConfig?.presence_penalty !== undefined 
    ? Number(aiConfig.presence_penalty) 
    : null;

  const prompt = buildMultiSubmissionPrompt({
    rubricSnapshot,
    submissions,
    tasks,
    locale: locale ?? 'es-ES'
  });

  const requestOptions = {
    model,
    temperature,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: 'Eres un asistente evaluador de proyectos de emprendimiento para alumnado de formación. Aplicas rúbricas objetivas con un enfoque pedagógico, claro y constructivo. Evalúa múltiples entregas como un conjunto coherente.'
      },
      {
        role: 'user',
        content: prompt
      }
    ]
  };

  // Solo añadir parámetros opcionales si están configurados
  if (maxTokens && maxTokens > 0) {
    requestOptions.max_tokens = Math.floor(maxTokens);
  }
  if (topP !== null && topP !== undefined) {
    requestOptions.top_p = topP;
  }
  if (frequencyPenalty !== null && frequencyPenalty !== undefined) {
    requestOptions.frequency_penalty = frequencyPenalty;
  }
  if (presencePenalty !== null && presencePenalty !== undefined) {
    requestOptions.presence_penalty = presencePenalty;
  }

  const response = await client.chat.completions.create(requestOptions);

  const messageContent = response.choices?.[0]?.message?.content;
  if (!messageContent) {
    throw new Error('La respuesta de OpenAI no contiene contenido');
  }

  let parsed;
  try {
    parsed = JSON.parse(messageContent);
  } catch (error) {
    logger.error('No se pudo parsear la respuesta de OpenAI', {
      error: error.message,
      raw: messageContent
    });
    throw new Error('La respuesta de OpenAI no es JSON válido');
  }

  // Manejar tanto el formato nuevo (con resumen) como el formato antiguo (compatibilidad)
  let overallScore = null;
  let overallFeedback = '';

  if (parsed.resumen) {
    // Formato nuevo mejorado
    overallScore = parsed.resumen.nota_global ?? null;
    overallFeedback = parsed.resumen.comentario_global ?? '';
  } else {
    // Formato antiguo (compatibilidad hacia atrás)
    overallScore = parsed.overallScore ?? null;
    overallFeedback = parsed.overallFeedback ?? '';
  }

  // Procesar criterios: el formato nuevo incluye fortalezas y mejoras
  const criteria = Array.isArray(parsed.criterios) 
    ? parsed.criterios.map(c => ({
        criterionId: c.criterionId ?? c.id ?? null,
        score: c.score ?? null,
        feedback: c.justificacion ?? c.feedback ?? '',
        fortalezas: Array.isArray(c.fortalezas) ? c.fortalezas : [],
        mejoras: Array.isArray(c.mejoras) ? c.mejoras : [],
        nombre: c.nombre ?? null,
        peso_porcentaje: c.peso_porcentaje ?? null
      }))
    : Array.isArray(parsed.criteria)
      ? parsed.criteria.map(c => ({
          criterionId: c.criterionId ?? c.id ?? null,
          score: c.score ?? null,
          feedback: c.feedback ?? '',
          fortalezas: [],
          mejoras: [],
          nombre: null,
          peso_porcentaje: null
        }))
      : [];

  return {
    rubricSnapshot,
    overallScore,
    overallFeedback,
    criteria,
    raw: parsed,
    usage: response.usage
  };
}

