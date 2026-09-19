/** Einheitliche Formatierung von Datum, Zeit und Groessen. */

const DATE_TIME = new Intl.DateTimeFormat('de-DE', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Berlin',
});

const DATE_ONLY = new Intl.DateTimeFormat('de-DE', {
  dateStyle: 'medium',
  timeZone: 'Europe/Berlin',
});

const TIME_ONLY = new Intl.DateTimeFormat('de-DE', {
  timeStyle: 'short',
  timeZone: 'Europe/Berlin',
});

const WEEKDAY_LONG = new Intl.DateTimeFormat('de-DE', {
  weekday: 'long',
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/Berlin',
});

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return '';
  return DATE_TIME.format(new Date(value));
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return '';
  return DATE_ONLY.format(new Date(value));
}

export function formatTime(value: Date | string | null | undefined): string {
  if (!value) return '';
  return TIME_ONLY.format(new Date(value));
}

export function formatLongDate(value: Date | string | null | undefined): string {
  if (!value) return '';
  return WEEKDAY_LONG.format(new Date(value));
}

export function formatRange(
  start: Date | string,
  end: Date | string,
  allDay = false,
): string {
  const from = new Date(start);
  const to = new Date(end);
  const sameDay = from.toDateString() === to.toDateString();

  if (allDay) {
    return sameDay ? formatDate(from) : `${formatDate(from)} bis ${formatDate(to)}`;
  }
  if (sameDay) {
    return `${formatDate(from)}, ${formatTime(from)} bis ${formatTime(to)} Uhr`;
  }
  return `${formatDateTime(from)} bis ${formatDateTime(to)}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

/** Relative Angabe wie "in 3 Tagen" oder "vor 2 Stunden". */
export function formatRelative(value: Date | string | null | undefined): string {
  if (!value) return '';
  const target = new Date(value).getTime();
  const diffMs = target - Date.now();
  const formatter = new Intl.RelativeTimeFormat('de-DE', { numeric: 'auto' });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 365 * 24 * 3600_000],
    ['month', 30 * 24 * 3600_000],
    ['day', 24 * 3600_000],
    ['hour', 3600_000],
    ['minute', 60_000],
  ];
  for (const [unit, ms] of units) {
    if (Math.abs(diffMs) >= ms) {
      return formatter.format(Math.round(diffMs / ms), unit);
    }
  }
  return 'gerade eben';
}

/** Erzeugt einen URL-tauglichen Bezeichner aus einem Titel. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}
