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
    'evaluations.taskNotAvailable': 'La tarea asociada a la entrega no está disponible',
    // Equipos
    'teams.userNotFoundByEmail': 'No se encontró ningún usuario con el correo electrónico {email}. El usuario debe estar registrado previamente en la plataforma.',
    'teams.userIdOrEmailRequired': 'Debes indicar user_id o user_email',
    'teams.memberNotFound': 'Miembro no encontrado',
    'teams.cannotRemoveCaptainIfOnlyMember': 'No puedes eliminar al capitán si es el único miembro del equipo',
    'teams.mustAssignCaptainBeforeLeave': 'Debes asignar otro capitán antes de abandonar el equipo',
    'teams.userNotMemberOfTeam': 'El usuario no es miembro del equipo',
    'teams.onlyActiveMembersCanBeCaptain': 'Solo los miembros activos pueden ser asignados como capitán',
    'teams.unauthorizedToChangeStatus': 'No autorizado para cambiar el estado del equipo',
    'teams.invalidStatus': 'Estado inválido. Debe ser "open" o "closed"',
    'teams.cannotOpenTeamWithInactiveProject': 'No se puede abrir un equipo cuyo proyecto está inactivo',
    'teams.teamNotOpenForMembers': 'El equipo no está abierto para nuevos miembros',
    'teams.alreadyMemberOfTeam': 'Ya eres miembro de este equipo',
    'teams.mustAssignCaptainBeforeJoinOtherTeam': 'Debes asignar otro capitán a tu equipo actual antes de unirte a otro equipo',
    'teams.notMemberOfTeam': 'No eres miembro de este equipo',
    'teams.cannotLeaveIfOnlyMember': 'No puedes abandonar el equipo si eres el único miembro',
    // Común
    'common.unauthorized': 'Acceso no autorizado'
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
    'evaluations.taskNotAvailable': 'La tasca associada al lliurament no està disponible',
    // Equipos
    'teams.userNotFoundByEmail': 'No s\'ha trobat cap usuari amb el correu electrònic {email}. L\'usuari ha d\'estar registrat prèviament a la plataforma.',
    'teams.userIdOrEmailRequired': 'Has d\'indicar user_id o user_email',
    'teams.memberNotFound': 'Membre no trobat',
    'teams.cannotRemoveCaptainIfOnlyMember': 'No pots eliminar el capità si és l\'únic membre de l\'equip',
    'teams.mustAssignCaptainBeforeLeave': 'Has d\'assignar un altre capità abans d\'abandonar l\'equip',
    'teams.userNotMemberOfTeam': 'L\'usuari no és membre de l\'equip',
    'teams.onlyActiveMembersCanBeCaptain': 'Només els membres actius poden ser assignats com a capità',
    'teams.unauthorizedToChangeStatus': 'No autoritzat per canviar l\'estat de l\'equip',
    'teams.invalidStatus': 'Estat invàlid. Ha de ser "open" o "closed"',
    'teams.cannotOpenTeamWithInactiveProject': 'No es pot obrir un equip el projecte del qual està inactiu',
    'teams.teamNotOpenForMembers': 'L\'equip no està obert per a nous membres',
    'teams.alreadyMemberOfTeam': 'Ja ets membre d\'aquest equip',
    'teams.mustAssignCaptainBeforeJoinOtherTeam': 'Has d\'assignar un altre capità al teu equip actual abans d\'unir-te a un altre equip',
    'teams.notMemberOfTeam': 'No ets membre d\'aquest equip',
    'teams.cannotLeaveIfOnlyMember': 'No pots abandonar l\'equip si ets l\'únic membre',
    // Común
    'common.unauthorized': 'Accés no autoritzat'
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
    'evaluations.taskNotAvailable': 'The task associated with the submission is not available',
    // Teams
    'teams.userNotFoundByEmail': 'No user found with email {email}. The user must be previously registered on the platform.',
    'teams.userIdOrEmailRequired': 'You must specify user_id or user_email',
    'teams.memberNotFound': 'Member not found',
    'teams.cannotRemoveCaptainIfOnlyMember': 'You cannot remove the captain if they are the only member of the team',
    'teams.mustAssignCaptainBeforeLeave': 'You must assign another captain before leaving the team',
    'teams.userNotMemberOfTeam': 'The user is not a member of the team',
    'teams.onlyActiveMembersCanBeCaptain': 'Only active members can be assigned as captain',
    'teams.unauthorizedToChangeStatus': 'Unauthorized to change team status',
    'teams.invalidStatus': 'Invalid status. Must be "open" or "closed"',
    'teams.cannotOpenTeamWithInactiveProject': 'Cannot open a team whose project is inactive',
    'teams.teamNotOpenForMembers': 'The team is not open for new members',
    'teams.alreadyMemberOfTeam': 'You are already a member of this team',
    'teams.mustAssignCaptainBeforeJoinOtherTeam': 'You must assign another captain to your current team before joining another team',
    'teams.notMemberOfTeam': 'You are not a member of this team',
    'teams.cannotLeaveIfOnlyMember': 'You cannot leave the team if you are the only member',
    // Common
    'common.unauthorized': 'Unauthorized access'
  }
};

/**
 * Obtiene el idioma del usuario desde req.user o usa el idioma por defecto
 * @param {import('express').Request} req - Request de Express
 * @returns {string} Código de idioma ('es', 'ca', 'en')
 */
export function getUserLanguage(req) {
  // Obtener idioma del usuario autenticado
  // Intentar acceder al campo language de diferentes formas para compatibilidad con Sequelize
  const userLanguage = req.user?.language || req.user?.get?.('language') || req.user?.dataValues?.language;
  
  // Normalizar el idioma (trim y lowercase)
  const normalizedLanguage = userLanguage ? String(userLanguage).trim().toLowerCase() : null;
  
  // Validar que el idioma sea uno de los soportados
  if (normalizedLanguage && ['es', 'ca', 'en'].includes(normalizedLanguage)) {
    return normalizedLanguage;
  }
  
  // Idioma por defecto: español
  return 'es';
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

