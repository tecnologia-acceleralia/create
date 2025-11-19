/**
 * Helpers para respuestas HTTP consistentes
 */

/**
 * Envía una respuesta exitosa
 * @param {import('express').Response} res - Response de Express
 * @param {any} data - Datos a enviar
 * @param {number} statusCode - Código de estado HTTP (default: 200)
 * @returns {import('express').Response} Response
 */
export function successResponse(res, data, statusCode = 200) {
  return res.status(statusCode).json({ success: true, data });
}

/**
 * Envía una respuesta de error
 * @param {import('express').Response} res - Response de Express
 * @param {string} message - Mensaje de error
 * @param {number} statusCode - Código de estado HTTP (default: 500)
 * @returns {import('express').Response} Response
 */
export function errorResponse(res, message, statusCode = 500) {
  return res.status(statusCode).json({ success: false, message });
}

/**
 * Envía una respuesta 404 (No encontrado)
 * @param {import('express').Response} res - Response de Express
 * @param {string} message - Mensaje de error (default: 'Recurso no encontrado')
 * @returns {import('express').Response} Response
 */
export function notFoundResponse(res, message = 'Recurso no encontrado') {
  return res.status(404).json({ success: false, message });
}

/**
 * Envía una respuesta 401 (No autorizado)
 * @param {import('express').Response} res - Response de Express
 * @param {string} message - Mensaje de error (default: 'No autorizado')
 * @returns {import('express').Response} Response
 */
export function unauthorizedResponse(res, message = 'No autorizado') {
  return res.status(401).json({ success: false, message });
}

/**
 * Envía una respuesta 403 (Prohibido)
 * @param {import('express').Response} res - Response de Express
 * @param {string} message - Mensaje de error (default: 'No autorizado')
 * @returns {import('express').Response} Response
 */
export function forbiddenResponse(res, message = 'No autorizado') {
  return res.status(403).json({ success: false, message });
}

/**
 * Envía una respuesta 400 (Solicitud incorrecta)
 * @param {import('express').Response} res - Response de Express
 * @param {string} message - Mensaje de error
 * @returns {import('express').Response} Response
 */
export function badRequestResponse(res, message) {
  return res.status(400).json({ success: false, message });
}

/**
 * Envía una respuesta 409 (Conflicto)
 * @param {import('express').Response} res - Response de Express
 * @param {string} message - Mensaje de error
 * @returns {import('express').Response} Response
 */
export function conflictResponse(res, message) {
  return res.status(409).json({ success: false, message });
}

