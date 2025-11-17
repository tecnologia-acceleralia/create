/**
 * Convierte un array de objetos a formato CSV
 * @param data Array de objetos con los datos
 * @param headers Array con los nombres de las columnas (opcional, se infiere de las claves del primer objeto)
 * @param fieldMapper Función opcional para mapear los valores de cada campo
 * @returns String con el contenido CSV
 */
export function arrayToCSV<T extends Record<string, unknown>>(
  data: T[],
  headers?: string[],
  fieldMapper?: (value: unknown, key: string) => string
): string {
  if (data.length === 0) {
    return '';
  }

  // Obtener headers si no se proporcionan
  // Si se proporcionan headers, usarlos; si no, obtener todas las claves únicas de todos los objetos
  const csvHeaders = headers ?? Array.from(new Set(data.flatMap(row => Object.keys(row))));

  if (csvHeaders.length === 0) {
    return '';
  }

  // Función para escapar valores CSV
  const escapeCSV = (value: unknown): string => {
    if (value === null || value === undefined) {
      return '';
    }
    const stringValue = fieldMapper ? fieldMapper(value, '') : String(value);
    // Si contiene comas, comillas o saltos de línea, envolver en comillas y escapar comillas internas
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  // Construir CSV
  const csvRows: string[] = [];

  // Headers
  csvRows.push(csvHeaders.map(escapeCSV).join(','));

  // Datos
  data.forEach(row => {
    const values = csvHeaders.map(header => {
      const value = row[header];
      return escapeCSV(value);
    });
    csvRows.push(values.join(','));
  });

  return csvRows.join('\n');
}

/**
 * Descarga un archivo CSV
 * @param csvContent Contenido CSV como string
 * @param filename Nombre del archivo (sin extensión .csv)
 */
export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

