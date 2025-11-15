export type DateInput = string | number | Date | null | undefined;

const DEFAULT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: 'short',
  year: 'numeric'
};

/**
 * Returns a valid Date instance or null if the input cannot be parsed.
 */
export function parseDate(value: DateInput): Date | null {
  if (value === null || value === undefined) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
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
  options: Intl.DateTimeFormatOptions = { dateStyle: 'short', timeStyle: 'short' },
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

