export type DateInput = string | number | Date | null | undefined;

const DEFAULT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: 'short',
  year: 'numeric'
};

const DEFAULT_DATETIME_OPTIONS: Intl.DateTimeFormatOptions = {
  dateStyle: 'short',
  timeStyle: 'short'
};

/**
 * Returns a valid Date instance or null if the input cannot be parsed.
 */
export function parseDate(value: DateInput): Date | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  // Si es un string, intentar parsearlo
  if (typeof value === 'string') {
    // Manejar strings vacíos
    const trimmed = value.trim();
    if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') {
      return null;
    }
    
    // Manejar strings en formato YYYY-MM-DD (sin hora) para evitar problemas de zona horaria
    const dateOnlyRegex = /^(\d{4})-(\d{2})-(\d{2})(?:\s|$)/;
    const dateOnlyMatch = dateOnlyRegex.exec(trimmed);
    if (dateOnlyMatch) {
      // Crear fecha en UTC para evitar problemas de zona horaria
      const [, year, month, day] = dateOnlyMatch;
      const date = new Date(Date.UTC(Number.parseInt(year, 10), Number.parseInt(month, 10) - 1, Number.parseInt(day, 10)));
      return Number.isNaN(date.getTime()) ? null : date;
    }
    
    // Para otros formatos, usar el constructor estándar
    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  // Para números (timestamps)
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Formats a date using Intl.DateTimeFormat. Returns null if the input is invalid.
 */
export function formatDate(
  locale: string,
  value: DateInput,
  options: Intl.DateTimeFormatOptions = DEFAULT_DATE_OPTIONS
): string | null {
  const date = parseDate(value);
  if (!date) {
    return null;
  }

  return new Intl.DateTimeFormat(locale, options).format(date);
}

/**
 * Formats a date range with the same formatting options for start and end.
 * Returns null if either boundary is invalid.
 */
export function formatDateRange(
  locale: string,
  startValue: DateInput,
  endValue: DateInput,
  options: Intl.DateTimeFormatOptions = DEFAULT_DATE_OPTIONS
): string | null {
  const start = formatDate(locale, startValue, options);
  const end = formatDate(locale, endValue, options);

  if (!start || !end) {
    return null;
  }

  return `${start} — ${end}`;
}

/**
 * Formats a date including time information. Returns `emptyFallback` when the
 * value is missing and the raw value (if string) when the input is invalid.
 */
export function formatDateTime(
  locale: string,
  value: DateInput,
  options: Intl.DateTimeFormatOptions = DEFAULT_DATETIME_OPTIONS,
  emptyFallback = '—'
): string {
  if (value === null || value === undefined || value === '') {
    return emptyFallback;
  }

  const date = parseDate(value);
  if (!date) {
    return typeof value === 'string' ? value : emptyFallback;
  }

  return new Intl.DateTimeFormat(locale, options).format(date);
}

/**
 * Formats a date using Date#toLocaleDateString. Returns null if the input is invalid.
 */
export function formatDateValue(value: DateInput, locale?: string): string | null {
  const date = parseDate(value);
  if (!date) {
    return null;
  }

  return locale ? date.toLocaleDateString(locale) : date.toLocaleDateString();
}

