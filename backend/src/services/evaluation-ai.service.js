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

function buildEvaluationPrompt({ rubricSnapshot, submission, task, locale }) {
  const instructions = [
    'Eres un evaluador experto que utiliza rúbricas estructuradas.',
    `Idioma requerido para la respuesta: ${locale ?? 'es-ES'}.`,
    'Debes calificar la entrega proporcionando puntajes por criterio y comentarios accionables.',
    'Responde estrictamente en formato JSON con la siguiente estructura:',
    `{
  "overallScore": number,
  "overallFeedback": string,
  "criteria": [
    {
      "criterionId": number,
      "score": number,
      "feedback": string
    }
  ]
}`,
    'Las puntuaciones deben respetar el rango definido por la rúbrica (scaleMin, scaleMax o maxScore por criterio si está presente).',
    'El feedback debe ser específico, orientado a mejoras y citar evidencias de la entrega.'
  ].join('\n');

  const criteriaDescription = rubricSnapshot.criteria
    .map(
      criterion =>
        `- ${criterion.title} (peso ${criterion.weight}${criterion.maxScore ? `, max ${criterion.maxScore}` : ''}): ${criterion.description || 'Sin descripción adicional'}`
    )
    .join('\n');

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

Rúbrica:
Nombre: ${rubricSnapshot.name}
Escala global: ${rubricSnapshot.scaleMin} - ${rubricSnapshot.scaleMax}
Criterios:
${criteriaDescription}

Entrega a evaluar:
${submissionContent}`;
}

export async function generateAiEvaluation({ rubric, submission, task, locale }) {
  const client = ensureClient();
  const rubricSnapshot = buildRubricSnapshot(rubric);
  const model = process.env.OPENAI_EVALUATION_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const prompt = buildEvaluationPrompt({
    rubricSnapshot,
    submission,
    task,
    locale: locale ?? 'es-ES'
  });

  const response = await client.chat.completions.create({
    model,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: 'Eres un evaluador especializado en innovación y hackatones que aplica rúbricas objetivas.'
      },
      {
        role: 'user',
        content: prompt
      }
    ]
  });

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

  return {
    rubricSnapshot,
    overallScore: parsed.overallScore ?? null,
    overallFeedback: parsed.overallFeedback ?? '',
    criteria: Array.isArray(parsed.criteria) ? parsed.criteria : [],
    raw: parsed,
    usage: response.usage
  };
}

