/**
 * Utilidades para trabajar con datos de usuarios
 */

/**
 * Obtiene el valor de grade desde registration_answers
 * @param {Object} user - Instancia del usuario o objeto con registration_answers
 * @returns {string|null} Valor de grade o null
 */
export function getUserGrade(user) {
  if (!user || !user.registration_answers) {
    return null;
  }
  const answers = typeof user.registration_answers === 'string' 
    ? JSON.parse(user.registration_answers) 
    : user.registration_answers;
  return answers?.grade || null;
}

/**
 * Establece el valor de grade en registration_answers
 * @param {Object} registrationAnswers - Objeto de respuestas existente o null
 * @param {string|null} grade - Valor de grade a establecer
 * @returns {Object|null} Objeto de respuestas actualizado o null si está vacío
 */
export function setGradeInAnswers(registrationAnswers, grade) {
  const answers = registrationAnswers && typeof registrationAnswers === 'object' && !Array.isArray(registrationAnswers)
    ? { ...registrationAnswers }
    : {};
  if (grade) {
    answers.grade = grade;
  } else if (answers.grade !== undefined) {
    delete answers.grade;
  }
  return Object.keys(answers).length > 0 ? answers : null;
}

