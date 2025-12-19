import OpenAI from 'openai';
import { logger } from '../utils/logger.js';
import { extractFilesContent } from './file-content-extractor.service.js';

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

function getLanguageConfig(locale) {
  const raw = (locale || 'es-ES').toString().toLowerCase();
  const short = raw.split('-')[0];

  let code = 'es';
  if (short === 'ca') code = 'ca';
  if (short === 'en') code = 'en';

  if (code === 'en') {
    return {
      code: 'en',
      // Etiqueta en castellano para el prompt largo existente
      languageLabel: 'inglés',
      // Mensaje de sistema en inglés para forzar idioma de salida
      systemMessage:
        'You are an assistant that evaluates entrepreneurship projects for students using rubrics. You apply objective rubrics with a pedagogical, clear and constructive approach. CRITICAL: You MUST answer entirely in ENGLISH. Do not use Spanish or Catalan in your answer, even if the project content or rubric are in those languages.',
      // Línea extra para reforzar idioma dentro del prompt de usuario
      promptLanguageNote:
        'REGLA CRÍTICA DE IDIOMA: TODO el comentario_global (análisis por criterios, fortalezas, mejoras y resumen global) debe estar escrito ÚNICAMENTE en ENGLISH. No escribas frases en español ni en catalán, aunque el contenido del proyecto o la rúbrica estén en esos idiomas.'
    };
  }

  if (code === 'ca') {
    return {
      code: 'ca',
      languageLabel: 'catalán',
      systemMessage:
        'Ets un assistent que avalua projectes d’emprenedoria per a alumnat utilitzant rúbriques objectives amb un enfocament pedagògic, clar i constructiu. CRÍTIC: Has de respondre SEMPRE íntegrament en CATALÀ. No utilitzis castellà ni anglès en la teva resposta, encara que el contingut del projecte o la rúbrica estiguin en altres idiomes.',
      promptLanguageNote:
        'REGLA CRÍTICA D’IDIOMA: TOT el comentari_global (anàlisi per criteris, fortaleses, millores i resum global) ha d’estar escrit ÚNICAMENT en CATALÀ. No escriguis frases en castellà ni en anglès, encara que el contingut del projecte o la rúbrica estiguin en aquests idiomes.'
    };
  }

  // Español por defecto
  return {
    code: 'es',
    languageLabel: 'español',
    systemMessage:
      'Eres un asistente evaluador de proyectos de emprendimiento para alumnado de formación. Aplicas rúbricas objetivas con un enfoque pedagógico, claro y constructivo. CRÍTICO: Debes responder SIEMPRE íntegramente en ESPAÑOL. No utilices catalán ni inglés en tu respuesta, aunque el contenido del proyecto o la rúbrica estén en otros idiomas.',
    promptLanguageNote:
      'REGLA CRÍTICA DE IDIOMA: TODO el comentario_global (análisis por criterios, fortalezas, mejoras y resumen global) debe estar escrito ÚNICAMENTE en ESPAÑOL. No escribas frases en catalán ni en inglés, aunque el contenido del proyecto o la rúbrica estén en esos idiomas.'
  };
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

function buildEvaluationPrompt({ rubricSnapshot, submission, task, locale, customPrompt, extractedFilesContent = [] }) {
  const { languageLabel: language, promptLanguageNote } = getLanguageConfig(locale);

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

    // Construir contenido de archivos extraído
    const filesContentText = extractedFilesContent
      .map(fileContent => {
        if (fileContent.error) {
          return `[Archivo: ${fileContent.original_name}]\n⚠️ Error al extraer contenido: ${fileContent.error}`;
        }
        if (fileContent.content) {
          return `[Archivo: ${fileContent.original_name} (${fileContent.mime_type})]\n${fileContent.content}`;
        }
        return `[Archivo: ${fileContent.original_name}]\n(Sin contenido extraíble)`;
      })
      .join('\n\n---\n\n');

    const submissionContent = [
      task?.title ? `Tarea: ${task.title}` : null,
      task?.description ? `Descripción de la tarea: ${task.description}` : null,
      `Contenido enviado:\n${submission.content ?? 'Sin texto proporcionado'}`,
      submission.files?.length
        ? `Archivos adjuntos (${submission.files.length} archivo${submission.files.length > 1 ? 's' : ''}):\n${submission.files
          .map(file => `* ${file.original_name ?? file.url} (${file.mime_type}, ${file.size_bytes} bytes)`)
          .join('\n')}`
        : 'Sin archivos adjuntos.',
      extractedFilesContent.length > 0 ? `\nCONTENIDO EXTRAÍDO DE ARCHIVOS:\n${filesContentText}` : null
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
    '   - Si hay más entregables de los que son opcionales, identifica estos entregables opcionales adicionales y tenlos en cuenta en tu evaluación global.',
    '',
    '2. Recorre TODOS los criterios definidos en la rúbrica. Para cada criterio:',
    '   - Ten en cuenta su descripción para entender qué aspecto del proyecto evalúa.',
    '   - Compara el contenido del proyecto con los niveles posibles de ese criterio.',
    '   - Asigna una puntuación (score) dentro del rango permitido (scaleMin, scaleMax o maxScore del criterio).',
    '   - Identifica 1-3 fortalezas relacionadas con ese criterio (si las hay).',
    '   - Identifica 1-3 aspectos de mejora concretos (si procede).',
    '   - Realiza un análisis exhaustivo alineando el criterio de la rúbrica con el contenido concreto de los entregables, explicando detalladamente cómo el contenido cumple o no cumple con cada aspecto del criterio y por qué asignas esa puntuación.',
    '',
    '3. Cálculo de la nota global:',
    '   - La nota global se calcula como la **media ponderada** de los criterios:',
    '       - `nota_global = SUMATORIO(score_criterio * peso_porcentaje/100)`.',
    '   - Las puntuaciones deben respetar el rango definido por la rúbrica (scaleMin, scaleMax o maxScore por criterio si está presente).',
    '   - No redondees hasta el final. Al mostrar las notas, puedes usar 2 decimales.',
    '   - IMPORTANTE: Debes incluir un DESGLOSE DE NOTAS después del RESUMEN GLOBAL que muestre explícitamente el cálculo de la nota final, indicando para cada criterio: nota × peso% = resultado, y luego la suma total.',
    '',
    '4. Manejo de información insuficiente:',
    '   - Si para algún criterio la información del proyecto es claramente insuficiente:',
    '       - Deja claro en la justificación que la información es limitada.',
    '       - Si realmente no puedes evaluar, indica que no hay información suficiente para ese criterio.',
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
    '    "comentario_global": "<texto estructurado en TEXTO PLANO (sin asteriscos, sin markdown, sin negrita) que incluya para CADA criterio de la rúbrica (en orden, usando el nombre exacto del criterio):\\n\\nCRITERIO X: [Nombre exacto del criterio según la rúbrica]\\nNota: [X puntos] (debe estar dentro del rango permitido)\\n\\nAnálisis:\\n[Análisis exhaustivo (8-12 líneas) alineando específicamente este criterio de la rúbrica con el contenido concreto de los entregables. Explica detalladamente:\\n- Cómo el contenido entregado se relaciona con la descripción y los niveles del criterio\\n- Qué elementos específicos del contenido cumplen o no cumplen con cada aspecto del criterio\\n- Citas o referencias concretas al contenido (texto, documentos, presentaciones) que justifican la puntuación asignada\\n- La relación entre lo que la rúbrica pide y lo que realmente se ha entregado\\nSé exhaustivo, específico y detallado, citando ejemplos concretos del contenido]\\n\\nFortalezas:\\n- [Fortaleza 1 relacionada específicamente con este criterio, con referencia concreta al contenido]\\n- [Fortaleza 2 si aplica]\\n- [Fortaleza 3 si aplica]\\n\\nMejoras:\\n- [Mejora concreta 1 relacionada específicamente con este criterio, con referencia a qué parte del contenido necesita mejorarse]\\n- [Mejora concreta 2 si aplica]\\n- [Mejora concreta 3 si aplica]\\n\\n---\\n\\n[Repetir este formato para TODOS los criterios de la rúbrica en el mismo orden en que aparecen]\\n\\n---\\n\\nRESUMEN GLOBAL\\n\\n[Resumen general del proyecto de 8-12 líneas, analizando en profundidad los puntos fuertes globales, áreas de mejora principales, coherencia general del proyecto y conclusiones principales. Sé específico y detallado, refiriéndote a aspectos concretos del contenido entregado. Si se han entregado más entregables de los que son opcionales, identifica y analiza también estos entregables opcionales adicionales en el resumen, explicando su valor y cómo complementan o enriquecen el proyecto.]\\n\\nDESGLOSE DE NOTAS\\n\\n[Desglose detallado del cálculo de la nota final mostrando para CADA criterio:\\n- [Nombre del criterio]: [nota asignada] puntos × [peso]% = [resultado con 2 decimales] puntos\\n\\nRepetir para todos los criterios en el mismo orden, y luego mostrar:\\nSuma total: [nota final calculada] puntos]\\n\\nNOTA GLOBAL: [Z puntos]\\n\\nIMPORTANTE: Todo el texto debe estar en TEXTO PLANO, sin usar asteriscos (**), sin markdown, sin negrita. Usa solo texto simple y saltos de línea para la estructura. El comentario debe ser exhaustivo, específico y detallado, alineando cada criterio de la rúbrica con el contenido concreto de los entregables. Usa el nombre exacto de cada criterio tal como aparece en la rúbrica. Las notas deben respetar los rangos definidos en la rúbrica. El DESGLOSE DE NOTAS DEBE aparecer después del RESUMEN GLOBAL y antes de la NOTA GLOBAL. La NOTA GLOBAL DEBE estar al final del comentario, después del DESGLOSE DE NOTAS.>"',
    '  }',
    '}',
    '',
    'REGLAS IMPORTANTES',
    '------------------',
    '',
    '- Usa SIEMPRE los criterios, pesos y niveles del archivo de rúbrica proporcionado.',
    '- No modifiques ni inventes nuevos criterios o pesos.',
    '- El comentario_global DEBE incluir TODOS los criterios de la rúbrica, cada uno con su nota, análisis exhaustivo alineando la rúbrica con el contenido de los entregables, fortalezas y mejoras.',
    '- El comentario_global DEBE terminar con un RESUMEN GLOBAL, seguido de un DESGLOSE DE NOTAS que muestre el cálculo detallado de la nota final (nota de cada criterio × peso), y finalmente la NOTA GLOBAL (media ponderada).',
    '- No des consejos genéricos que no estén vinculados al contenido concreto del proyecto.',
    '- No salgas nunca del formato JSON especificado.',
    '- Si el usuario no proporciona ningún contenido de proyecto, responde con `nota_global = null` y justifica en cada criterio que no hay información suficiente para evaluar.',
    `- Idioma requerido para la respuesta: ${language}.`,
    promptLanguageNote
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

    // Construir contenido de archivos extraído
    const filesContentText = extractedFilesContent
      .map(fileContent => {
        if (fileContent.error) {
          return `[Archivo: ${fileContent.original_name}]\n⚠️ Error al extraer contenido: ${fileContent.error}`;
        }
        if (fileContent.content) {
          return `[Archivo: ${fileContent.original_name} (${fileContent.mime_type})]\n${fileContent.content}`;
        }
        return `[Archivo: ${fileContent.original_name}]\n(Sin contenido extraíble)`;
      })
      .join('\n\n---\n\n');

  const submissionContent = [
    task?.title ? `Tarea: ${task.title}` : null,
    task?.description ? `Descripción de la tarea: ${task.description}` : null,
    `Contenido enviado:\n${submission.content ?? 'Sin texto proporcionado'}`,
    submission.files?.length
        ? `Archivos adjuntos (${submission.files.length} archivo${submission.files.length > 1 ? 's' : ''}):\n${submission.files
          .map(file => `* ${file.original_name ?? file.url} (${file.mime_type}, ${file.size_bytes} bytes)`)
        .join('\n')}`
        : 'Sin archivos adjuntos.',
      extractedFilesContent.length > 0 ? `\nCONTENIDO EXTRAÍDO DE ARCHIVOS:\n${filesContentText}` : null
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

  // Función auxiliar para extraer la nota global del texto del comentario
  function extractFinalScoreFromComment(comment) {
    if (!comment) return null;
    
    // Buscar específicamente la nota global que aparece después del RESUMEN GLOBAL
    // Primero, buscar el índice del RESUMEN GLOBAL para asegurarnos de que buscamos la nota global
    const resumenIndex = comment.toLowerCase().indexOf('resumen global');
    
    // Buscar "NOTA GLOBAL" en texto plano (sin asteriscos, que debería estar después del resumen) o con asteriscos como fallback
    // Usar regex global para encontrar todas las ocurrencias y tomar la última
    const patterns = [
      // Primero buscar formato plano (sin asteriscos) - formato preferido
      /NOTA GLOBAL:\s*(\d+(?:\.\d+)?)\s*puntos?/gi,
      /NOTA GLOBAL:\s*(\d+(?:\.\d+)?)/gi,
      // Fallback: también buscar con asteriscos por compatibilidad
      /\*\*NOTA GLOBAL:\s*(\d+(?:\.\d+)?)\s*puntos?\*\*/gi,
      /\*\*NOTA GLOBAL:\s*(\d+(?:\.\d+)?)\*\*/gi,
      // Fallback: también buscar "NOTA FINAL" por compatibilidad
      /NOTA FINAL:\s*(\d+(?:\.\d+)?)\s*puntos?/gi,
      /NOTA FINAL:\s*(\d+(?:\.\d+)?)/gi,
      /\*\*NOTA FINAL:\s*(\d+(?:\.\d+)?)\s*puntos?\*\*/gi,
      /\*\*NOTA FINAL:\s*(\d+(?:\.\d+)?)\*\*/gi
    ];
    
    // Buscar todas las coincidencias y tomar la última (que debería ser la nota final)
    let lastMatch = null;
    let lastIndex = -1;
    
    for (const pattern of patterns) {
      const matches = [...comment.matchAll(pattern)];
      if (matches.length > 0) {
        // Tomar la última coincidencia
        const match = matches[matches.length - 1];
        const matchIndex = match.index;
        // Preferir la que esté después del RESUMEN GLOBAL, o la última si no hay resumen
        if (resumenIndex === -1 || matchIndex > resumenIndex) {
          if (matchIndex > lastIndex) {
            lastMatch = match;
            lastIndex = matchIndex;
          }
        }
      }
    }
    
    // Si no encontramos una después del resumen, usar la última de todas
    if (!lastMatch) {
      for (const pattern of patterns) {
        const matches = [...comment.matchAll(pattern)];
        if (matches.length > 0) {
          lastMatch = matches[matches.length - 1];
          break;
        }
      }
    }
    
    if (lastMatch && lastMatch[1]) {
      const score = parseFloat(lastMatch[1]);
      if (!isNaN(score)) {
        return score;
      }
    }
    
    return null;
  }

  // Extraer contenido de archivos si existen
  let extractedFilesContent = [];
  if (submission.files && Array.isArray(submission.files) && submission.files.length > 0) {
    try {
      logger.info('Extrayendo contenido de archivos para evaluación', {
        fileCount: submission.files.length,
        files: submission.files.map(f => ({ name: f.original_name, type: f.mime_type }))
      });
      extractedFilesContent = await extractFilesContent(submission.files);
      logger.info('Contenido de archivos extraído', {
        successCount: extractedFilesContent.filter(f => f.success).length,
        errorCount: extractedFilesContent.filter(f => !f.success).length
      });
    } catch (error) {
      logger.error('Error al extraer contenido de archivos, continuando sin contenido de archivos', {
        error: error.message,
        stack: error.stack
      });
      // Continuar sin contenido de archivos en caso de error
      extractedFilesContent = [];
    }
  }

  const prompt = buildEvaluationPrompt({
    rubricSnapshot,
    submission,
    task,
    locale: locale ?? 'es-ES',
    customPrompt,
    extractedFilesContent
  });

  const localeForLanguage = locale ?? 'es-ES';
  const { systemMessage } = getLanguageConfig(localeForLanguage);

  const requestOptions = {
    model,
    temperature,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: systemMessage
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
    // Formato nuevo: solo comentario_global estructurado por criterio
    overallFeedback = parsed.resumen.comentario_global ?? '';
    // La nota global está dentro del texto del comentario, al final después del RESUMEN GLOBAL, extraerla
    overallScore = extractFinalScoreFromComment(overallFeedback);
  } else {
    // Formato antiguo (compatibilidad hacia atrás)
    overallScore = parsed.overallScore ?? null;
    overallFeedback = parsed.overallFeedback ?? '';
  }

  // Ya no procesamos criterios por separado, todo está en el comentario_global
  // Mantenemos criteria como array vacío para compatibilidad con código existente
  const criteria = [];

  return {
    rubricSnapshot,
    overallScore,
    overallFeedback,
    criteria,
    raw: parsed,
    usage: response.usage
  };
}

function buildMultiSubmissionPrompt({ rubricSnapshot, submissions, tasks, locale, extractedFilesContentBySubmission = {} }) {
  const { languageLabel: language, promptLanguageNote } = getLanguageConfig(locale);

  const instructions = [
    'Eres un asistente evaluador de proyectos de emprendimiento para alumnado de formación.',
    '',
    'Tu tarea es **evaluar múltiples entregas de un proyecto** como un conjunto coherente, siguiendo EXCLUSIVAMENTE la rúbrica proporcionada.',
    '',
    'INSTRUCCIONES DE EVALUACIÓN',
    '---------------------------',
    '',
    '1. Lee atentamente todas las entregas proporcionadas. Evalúa el trabajo completo de la fase/proyecto considerando todas las entregas en conjunto. Si hay más entregables de los que son opcionales, identifica estos entregables opcionales adicionales y tenlos en cuenta en tu evaluación global.',
    '',
    '2. Recorre TODOS los criterios definidos en la rúbrica. Para cada criterio:',
    '   - Ten en cuenta su descripción para entender qué aspecto del proyecto evalúa.',
    '   - Compara el contenido de todas las entregas con los niveles posibles de ese criterio.',
    '   - Asigna una puntuación (score) dentro del rango permitido (scaleMin, scaleMax o maxScore del criterio).',
    '   - Identifica 1-3 fortalezas relacionadas con ese criterio (si las hay).',
    '   - Identifica 1-3 aspectos de mejora concretos (si procede).',
    '   - Realiza un análisis exhaustivo alineando el criterio de la rúbrica con el contenido concreto de los entregables, explicando detalladamente cómo el contenido cumple o no cumple con cada aspecto del criterio y por qué asignas esa puntuación.',
    '',
    '3. Cálculo de la nota global:',
    '   - La nota global se calcula como la **media ponderada** de los criterios:',
    '       - `nota_global = SUMATORIO(score_criterio * peso_porcentaje/100)`.',
    '   - Las puntuaciones deben respetar el rango definido por la rúbrica (scaleMin, scaleMax o maxScore por criterio si está presente).',
    '   - IMPORTANTE: Debes incluir un DESGLOSE DE NOTAS después del RESUMEN GLOBAL que muestre explícitamente el cálculo de la nota final, indicando para cada criterio: nota × peso% = resultado, y luego la suma total.',
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
    '    "comentario_global": "<texto estructurado en TEXTO PLANO (sin asteriscos, sin markdown, sin negrita) que incluya para CADA criterio de la rúbrica (en orden, usando el nombre exacto del criterio):\\n\\nCRITERIO X: [Nombre exacto del criterio según la rúbrica]\\nNota: [X puntos] (debe estar dentro del rango permitido)\\n\\nAnálisis:\\n[Análisis exhaustivo (8-12 líneas) alineando específicamente este criterio de la rúbrica con el contenido concreto de los entregables. Explica detalladamente:\\n- Cómo el contenido entregado se relaciona con la descripción y los niveles del criterio\\n- Qué elementos específicos del contenido cumplen o no cumplen con cada aspecto del criterio\\n- Citas o referencias concretas al contenido (texto, documentos, presentaciones) que justifican la puntuación asignada\\n- La relación entre lo que la rúbrica pide y lo que realmente se ha entregado\\nSé exhaustivo, específico y detallado, citando ejemplos concretos del contenido de las diferentes entregas]\\n\\nFortalezas:\\n- [Fortaleza 1 relacionada específicamente con este criterio, con referencia concreta al contenido]\\n- [Fortaleza 2 si aplica]\\n- [Fortaleza 3 si aplica]\\n\\nMejoras:\\n- [Mejora concreta 1 relacionada específicamente con este criterio, con referencia a qué parte del contenido necesita mejorarse]\\n- [Mejora concreta 2 si aplica]\\n- [Mejora concreta 3 si aplica]\\n\\n---\\n\\n[Repetir este formato para TODOS los criterios de la rúbrica en el mismo orden en que aparecen]\\n\\n---\\n\\nRESUMEN GLOBAL\\n\\n[Resumen general del conjunto de entregas de 8-12 líneas, analizando en profundidad los puntos fuertes globales, áreas de mejora principales, coherencia general del proyecto y conclusiones principales. Sé específico y detallado, refiriéndote a aspectos concretos del contenido entregado en las diferentes entregas]\\n\\nDESGLOSE DE NOTAS\\n\\n[Desglose detallado del cálculo de la nota final mostrando para CADA criterio:\\n- [Nombre del criterio]: [nota asignada] puntos × [peso]% = [resultado con 2 decimales] puntos\\n\\nRepetir para todos los criterios en el mismo orden, y luego mostrar:\\nSuma total: [nota final calculada] puntos]\\n\\nNOTA GLOBAL: [Z puntos]\\n\\nIMPORTANTE: Todo el texto debe estar en TEXTO PLANO, sin usar asteriscos (**), sin markdown, sin negrita. Usa solo texto simple y saltos de línea para la estructura. El comentario debe ser exhaustivo, específico y detallado, alineando cada criterio de la rúbrica con el contenido concreto de los entregables. Usa el nombre exacto de cada criterio tal como aparece en la rúbrica. Las notas deben respetar los rangos definidos en la rúbrica. El DESGLOSE DE NOTAS DEBE aparecer después del RESUMEN GLOBAL y antes de la NOTA GLOBAL. La NOTA GLOBAL DEBE estar al final del comentario, después del DESGLOSE DE NOTAS.>"',
    '  }',
    '}',
    '',
    `- Idioma requerido para la respuesta: ${language}.`,
    promptLanguageNote
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
      
      // Obtener contenido extraído de archivos para esta submission
      // Usamos un identificador único: submission_id o combinación de task_id + índice
      const submissionKey = submission.submission_id || `${submission.task_id}-${index}`;
      const extractedFiles = extractedFilesContentBySubmission[submissionKey] || [];
      
      // Construir contenido de archivos extraído para esta submission
      const filesContentText = extractedFiles.length > 0
        ? extractedFiles
          .map(fileContent => {
            if (fileContent.error) {
              return `[Archivo: ${fileContent.original_name}]\n⚠️ Error al extraer contenido: ${fileContent.error}`;
            }
            if (fileContent.content) {
              return `[Archivo: ${fileContent.original_name} (${fileContent.mime_type})]\n${fileContent.content}`;
            }
            return `[Archivo: ${fileContent.original_name}]\n(Sin contenido extraíble)`;
          })
          .join('\n\n---\n\n')
        : '';
      
      const parts = [
        `Entrega ${index + 1} - ${task?.title ?? 'Tarea sin título'}:`,
        task?.description ? `Descripción: ${task.description}` : null,
        `Contenido: ${submission.content ?? 'Sin texto proporcionado'}`,
        submission.files?.length
          ? `Archivos adjuntos (${submission.files.length} archivo${submission.files.length > 1 ? 's' : ''}):\n${submission.files
            .map(file => `* ${file.original_name ?? file.url} (${file.mime_type}, ${file.size_bytes} bytes)`)
    .join('\n')}`
          : 'Sin archivos adjuntos.',
        filesContentText ? `CONTENIDO EXTRAÍDO DE ARCHIVOS:\n${filesContentText}` : null,
        `Fecha de entrega: ${submission.submitted_at ? new Date(submission.submitted_at).toLocaleString(locale ?? 'es-ES') : 'N/A'}`
      ].filter(Boolean);
      
      return parts.join('\n\n') + '\n---';
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

  // Función auxiliar para extraer la nota global del texto del comentario
  function extractFinalScoreFromComment(comment) {
    if (!comment) return null;
    
    // Buscar específicamente la nota global que aparece después del RESUMEN GLOBAL
    // Primero, buscar el índice del RESUMEN GLOBAL para asegurarnos de que buscamos la nota global
    const resumenIndex = comment.toLowerCase().indexOf('resumen global');
    
    // Buscar "NOTA GLOBAL" en texto plano (sin asteriscos, que debería estar después del resumen) o con asteriscos como fallback
    // Usar regex global para encontrar todas las ocurrencias y tomar la última
    const patterns = [
      // Primero buscar formato plano (sin asteriscos) - formato preferido
      /NOTA GLOBAL:\s*(\d+(?:\.\d+)?)\s*puntos?/gi,
      /NOTA GLOBAL:\s*(\d+(?:\.\d+)?)/gi,
      // Fallback: también buscar con asteriscos por compatibilidad
      /\*\*NOTA GLOBAL:\s*(\d+(?:\.\d+)?)\s*puntos?\*\*/gi,
      /\*\*NOTA GLOBAL:\s*(\d+(?:\.\d+)?)\*\*/gi,
      // Fallback: también buscar "NOTA FINAL" por compatibilidad
      /NOTA FINAL:\s*(\d+(?:\.\d+)?)\s*puntos?/gi,
      /NOTA FINAL:\s*(\d+(?:\.\d+)?)/gi,
      /\*\*NOTA FINAL:\s*(\d+(?:\.\d+)?)\s*puntos?\*\*/gi,
      /\*\*NOTA FINAL:\s*(\d+(?:\.\d+)?)\*\*/gi
    ];
    
    // Buscar todas las coincidencias y tomar la última (que debería ser la nota final)
    let lastMatch = null;
    let lastIndex = -1;
    
    for (const pattern of patterns) {
      const matches = [...comment.matchAll(pattern)];
      if (matches.length > 0) {
        // Tomar la última coincidencia
        const match = matches[matches.length - 1];
        const matchIndex = match.index;
        // Preferir la que esté después del RESUMEN GLOBAL, o la última si no hay resumen
        if (resumenIndex === -1 || matchIndex > resumenIndex) {
          if (matchIndex > lastIndex) {
            lastMatch = match;
            lastIndex = matchIndex;
          }
        }
      }
    }
    
    // Si no encontramos una después del resumen, usar la última de todas
    if (!lastMatch) {
      for (const pattern of patterns) {
        const matches = [...comment.matchAll(pattern)];
        if (matches.length > 0) {
          lastMatch = matches[matches.length - 1];
          break;
        }
      }
    }
    
    if (lastMatch && lastMatch[1]) {
      const score = parseFloat(lastMatch[1]);
      if (!isNaN(score)) {
        return score;
      }
    }
    
    return null;
  }

  // Extraer contenido de archivos para todas las submissions
  const extractedFilesContentBySubmission = {};
  const allFiles = [];
  const fileToSubmissionMap = new Map(); // Mapa para relacionar archivos con sus submissions

  for (let i = 0; i < submissions.length; i++) {
    const submission = submissions[i];
    const submissionKey = submission.submission_id || `${submission.task_id}-${i}`;
    
    if (submission.files && Array.isArray(submission.files) && submission.files.length > 0) {
      // Mapear archivos a su submission
      submission.files.forEach(file => {
        allFiles.push(file);
        if (!fileToSubmissionMap.has(file.url)) {
          fileToSubmissionMap.set(file.url, []);
        }
        fileToSubmissionMap.get(file.url).push(submissionKey);
      });
    }
  }

  // Extraer contenido de todos los archivos únicos
  if (allFiles.length > 0) {
    try {
      logger.info('Extrayendo contenido de archivos para evaluación de múltiples entregas', {
        totalFiles: allFiles.length,
        submissionsCount: submissions.length
      });
      
      const extractedFiles = await extractFilesContent(allFiles);
      
      // Organizar contenido extraído por submission
      extractedFiles.forEach((extractedFile, index) => {
        const originalFile = allFiles[index];
        const submissionKeys = fileToSubmissionMap.get(originalFile.url) || [];
        
        submissionKeys.forEach(submissionKey => {
          if (!extractedFilesContentBySubmission[submissionKey]) {
            extractedFilesContentBySubmission[submissionKey] = [];
          }
          extractedFilesContentBySubmission[submissionKey].push(extractedFile);
        });
      });
      
      logger.info('Contenido de archivos extraído y organizado por submission', {
        submissionsWithFiles: Object.keys(extractedFilesContentBySubmission).length,
        totalExtracted: extractedFiles.filter(f => f.success).length,
        totalErrors: extractedFiles.filter(f => !f.success).length
      });
    } catch (error) {
      logger.error('Error al extraer contenido de archivos, continuando sin contenido de archivos', {
        error: error.message,
        stack: error.stack
      });
      // Continuar sin contenido de archivos en caso de error
    }
  }

  const prompt = buildMultiSubmissionPrompt({
    rubricSnapshot,
    submissions,
    tasks,
    locale: locale ?? 'es-ES',
    extractedFilesContentBySubmission
  });

  const localeForLanguage = locale ?? 'es-ES';
  const { systemMessage } = getLanguageConfig(localeForLanguage);

  const requestOptions = {
    model,
    temperature,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: systemMessage
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
    // Formato nuevo: solo comentario_global estructurado por criterio
    overallFeedback = parsed.resumen.comentario_global ?? '';
    // La nota global está dentro del texto del comentario, al final después del RESUMEN GLOBAL, extraerla
    overallScore = extractFinalScoreFromComment(overallFeedback);
  } else {
    // Formato antiguo (compatibilidad hacia atrás)
    overallScore = parsed.overallScore ?? null;
    overallFeedback = parsed.overallFeedback ?? '';
  }

  // Ya no procesamos criterios por separado, todo está en el comentario_global
  // Mantenemos criteria como array vacío para compatibilidad con código existente
  const criteria = [];

  return {
    rubricSnapshot,
    overallScore,
    overallFeedback,
    criteria,
    raw: parsed,
    usage: response.usage
  };
}
