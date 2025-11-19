import { getModels } from '../models/index.js';
import { toInt } from './parsers.js';

/**
 * Busca un registro por ID o lanza un error 404
 * @param {any} Model - Modelo de Sequelize
 * @param {any} id - ID del registro
 * @param {object} options - Opciones adicionales para la búsqueda (include, where, etc.)
 * @param {string} errorMessage - Mensaje de error personalizado (default: 'Recurso no encontrado')
 * @returns {Promise<any>} Instancia del modelo encontrada
 * @throws {Error} Error con statusCode 404 si no se encuentra
 */
export async function findOr404(Model, id, options = {}, errorMessage = 'Recurso no encontrado') {
  const parsedId = toInt(id);
  const result = await Model.findOne({
    where: { id: parsedId },
    ...options
  });

  if (!result) {
    const error = new Error(errorMessage);
    error.statusCode = 404;
    throw error;
  }

  return result;
}

/**
 * Busca un evento por ID o lanza un error 404
 * @param {any} eventId - ID del evento
 * @returns {Promise<any>} Instancia del evento encontrado
 * @throws {Error} Error con statusCode 404 si no se encuentra
 */
export async function findEventOr404(eventId) {
  const { Event, Phase, Task, PhaseRubric } = getModels();
  const id = toInt(eventId);
  const event = await Event.findOne({
    where: { id },
    include: [
      { model: Phase, as: 'phases', separate: true, order: [['order_index', 'ASC']] },
      { model: Task, as: 'tasks', separate: true },
      {
        model: PhaseRubric,
        as: 'rubrics',
        separate: true,
        include: [{ association: 'criteria' }],
        order: [['created_at', 'DESC']]
      }
    ]
  });

  if (!event) {
    const error = new Error('Evento no encontrado');
    error.statusCode = 404;
    throw error;
  }

  return event;
}

/**
 * Busca la membresía de un usuario en un evento
 * @param {number} userId - ID del usuario
 * @param {number} eventId - ID del evento
 * @returns {Promise<any|null>} Membresía encontrada o null
 */
export async function findMembership(userId, eventId) {
  const { TeamMember, Team } = getModels();
  return TeamMember.findOne({
    where: { user_id: userId },
    include: [{ model: Team, as: 'team', where: { event_id: eventId } }]
  });
}

