/**
 * Utilidades para internacionalización (i18n) en el backend
 * Soporta español (es), catalán (ca) e inglés (en)
 */

const translations = {
  es: {
    // Evaluaciones
    'evaluations.submissionNotFound': 'Entrega no encontrada',
    'evaluations.commentRequired': 'El comentario es requerido',
    'evaluations.commentCannotBeEmpty': 'El comentario no puede estar vacío',
    'evaluations.scoreRange10': 'La puntuación debe estar entre 0 y 10',
    'evaluations.scoreRange100': 'La puntuación debe estar entre 0 y 100',
    'evaluations.atLeastOneSubmissionRequired': 'Debe proporcionar al menos una entrega para evaluar',
    'evaluations.teamNotInSameEvent': 'El equipo no pertenece al mismo evento que la fase',
    'evaluations.submissionsNotBelongToTeamOrPhase': 'Algunas entregas no pertenecen al equipo o a tareas de esta fase',
    'evaluations.submissionsNotBelongToTeamOrEvent': 'Algunas entregas no pertenecen al equipo o al evento',
    'evaluations.phaseNotFound': 'Fase no encontrada',
    'evaluations.teamNotFound': 'Equipo no encontrado',
    'evaluations.projectNotFound': 'Proyecto no encontrado',
    'evaluations.rubricNotConfigured': 'No hay una rúbrica configurada para esta fase o tarea',
    'evaluations.rubricNotConfiguredForPhase': 'No hay una rúbrica configurada para esta fase',
    'evaluations.evaluationNotFound': 'Evaluación no encontrada',
    'evaluations.noFinalEvaluation': 'No hay evaluación final para esta entrega',
    'evaluations.mustEvaluatePhaseFirst': 'Debe evaluar primero la fase "{phaseName}" antes de evaluar el proyecto completo',
    'evaluations.tenantCannotBeDetermined': 'No se pudo determinar el tenant para la evaluación',
    'evaluations.aiServiceNotConfigured': 'Servicio de IA no configurado',
    'evaluations.taskNotAvailable': 'La tarea asociada a la entrega no está disponible'
  },
  ca: {
    // Evaluaciones
    'evaluations.submissionNotFound': 'Lliurament no trobat',
    'evaluations.commentRequired': 'El comentari és requerit',
    'evaluations.commentCannotBeEmpty': 'El comentari no pot estar buit',
    'evaluations.scoreRange10': 'La puntuació ha d\'estar entre 0 i 10',
    'evaluations.scoreRange100': 'La puntuació ha d\'estar entre 0 i 100',
    'evaluations.atLeastOneSubmissionRequired': 'Has de proporcionar almenys un lliurament per avaluar',
    'evaluations.teamNotInSameEvent': 'L\'equip no pertany al mateix esdeveniment que la fase',
    'evaluations.submissionsNotBelongToTeamOrPhase': 'Alguns lliuraments no pertanyen a l\'equip o a tasques d\'aquesta fase',
    'evaluations.submissionsNotBelongToTeamOrEvent': 'Alguns lliuraments no pertanyen a l\'equip o a l\'esdeveniment',
    'evaluations.phaseNotFound': 'Fase no trobada',
    'evaluations.teamNotFound': 'Equip no trobat',
    'evaluations.projectNotFound': 'Projecte no trobat',
    'evaluations.rubricNotConfigured': 'No hi ha una rúbrica configurada per a aquesta fase o tasca',
    'evaluations.rubricNotConfiguredForPhase': 'No hi ha una rúbrica configurada per a aquesta fase',
    'evaluations.evaluationNotFound': 'Avaluació no trobada',
    'evaluations.noFinalEvaluation': 'No hi ha avaluació final per a aquest lliurament',
    'evaluations.mustEvaluatePhaseFirst': 'Has d\'avaluar primer la fase "{phaseName}" abans d\'avaluar el projecte complet',
    'evaluations.tenantCannotBeDetermined': 'No s\'ha pogut determinar el tenant per a l\'avaluació',
    'evaluations.aiServiceNotConfigured': 'Servei d\'IA no configurat',
    'evaluations.taskNotAvailable': 'La tasca associada al lliurament no està disponible'
  },
  en: {
    // Evaluaciones
    'evaluations.submissionNotFound': 'Submission not found',
    'evaluations.commentRequired': 'Comment is required',
    'evaluations.commentCannotBeEmpty': 'Comment cannot be empty',
    'evaluations.scoreRange10': 'Score must be between 0 and 10',
    'evaluations.scoreRange100': 'Score must be between 0 and 100',
    'evaluations.atLeastOneSubmissionRequired': 'You must provide at least one submission to evaluate',
    'evaluations.teamNotInSameEvent': 'The team does not belong to the same event as the phase',
    'evaluations.submissionsNotBelongToTeamOrPhase': 'Some submissions do not belong to the team or tasks of this phase',
    'evaluations.submissionsNotBelongToTeamOrEvent': 'Some submissions do not belong to the team or event',
    'evaluations.phaseNotFound': 'Phase not found',
    'evaluations.teamNotFound': 'Team not found',
    'evaluations.projectNotFound': 'Project not found',
    'evaluations.rubricNotConfigured': 'There is no rubric configured for this phase or task',
    'evaluations.rubricNotConfiguredForPhase': 'There is no rubric configured for this phase',
    'evaluations.evaluationNotFound': 'Evaluation not found',
    'evaluations.noFinalEvaluation': 'There is no final evaluation for this submission',
    'evaluations.mustEvaluatePhaseFirst': 'You must evaluate the phase "{phaseName}" first before evaluating the complete project',
    'evaluations.tenantCannotBeDetermined': 'Could not determine the tenant for the evaluation',
    'evaluations.aiServiceNotConfigured': 'AI service not configured',
    'evaluations.taskNotAvailable': 'The task associated with the submission is not available'
  }
};

/**
 * Obtiene el idioma del usuario desde req.user o usa el idioma por defecto
 * @param {import('express').Request} req - Request de Express
 * @returns {string} Código de idioma ('es', 'ca', 'en')
 */
export function getUserLanguage(req) {
  const userLanguage = req.user?.language;
  if (userLanguage && ['es', 'ca', 'en'].includes(userLanguage)) {
    return userLanguage;
  }
  return 'es'; // Idioma por defecto
}

/**
 * Traduce un mensaje según el idioma del usuario
 * @param {import('express').Request} req - Request de Express
 * @param {string} key - Clave de traducción
 * @param {Record<string, any>} params - Parámetros para interpolación
 * @returns {string} Mensaje traducido
 */
export function t(req, key, params = {}) {
  const language = getUserLanguage(req);
  let message = translations[language]?.[key] || translations.es[key] || key;

  // Interpolación de parámetros (ej: "{phaseName}" -> valor)
  if (params && Object.keys(params).length > 0) {
    Object.entries(params).forEach(([paramKey, paramValue]) => {
      message = message.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue));
    });
  }

  return message;
}

