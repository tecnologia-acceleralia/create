/**
 * Utilidades para paginación y ordenamiento
 */

/**
 * Normaliza el campo y orden de ordenamiento
 * @param {string} sortField - Campo a ordenar
 * @param {string} sortOrder - Orden ('asc' o 'desc')
 * @param {object} map - Mapa de campos permitidos
 * @param {string} defaultField - Campo por defecto
 * @returns {[string, string]} Tupla [campo, orden] normalizada
 */
export function normalizeSort(sortField, sortOrder, map, defaultField) {
  const resolvedField = map[sortField] ?? map[defaultField] ?? defaultField;
  const normalizedOrder = sortOrder === 'asc' ? 'ASC' : 'DESC';
  return [resolvedField, normalizedOrder];
}

/**
 * Mapea resultados agrupados a un objeto con conteos
 * @param {any[]} results - Resultados de una consulta agrupada
 * @param {string} key - Clave del campo a usar como índice (default: 'status')
 * @returns {object} Objeto con conteos por valor
 */
export function mapGroupedCount(results, key = 'status') {
  if (!Array.isArray(results)) {
    return {};
  }

  return results.reduce((accumulator, entry) => {
    if (!entry || !Object.prototype.hasOwnProperty.call(entry, key)) {
      return accumulator;
    }
    const value = entry[key];
    const count = Number(entry.count ?? entry?.dataValues?.count ?? 0);
    accumulator[value] = count;
    return accumulator;
  }, {});
}

/**
 * Construye metadatos de paginación
 * @param {object} params - Parámetros de paginación
 * @param {number} params.page - Página actual
 * @param {number} params.pageSize - Tamaño de página
 * @param {number} params.totalItems - Total de elementos
 * @returns {object} Metadatos de paginación
 */
export function buildPaginationMeta({ page, pageSize, totalItems }) {
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);
  return {
    page,
    pageSize,
    totalItems,
    totalPages
  };
}

