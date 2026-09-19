/** Erzeugt iCalendar-Dateien fuer Termine und Events. */

export type IcsEvent = {
  uid: string;
  title: string;
  description?: string | null;
  location?: string | null;
  start: Date;
  end: Date;
  allDay?: boolean;
  url?: string | null;
  organizer?: { name?: string | null; email: string } | null;
  status?: 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED';
  recurrence?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function toUtcStamp(date: Date): string {
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

function toDateValue(date: Date): string {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
}

/** Maskiert Sonderzeichen gemaess RFC 5545. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Faltet lange Zeilen auf 75 Oktette, wie es der Standard verlangt. */
function foldLine(line: string): string {
  if (Buffer.byteLength(line, 'utf8') <= 75) return line;
  const parts: string[] = [];
  let current = '';
  for (const char of line) {
    if (Buffer.byteLength(current + char, 'utf8') > 74) {
      parts.push(current);
      current = ' ' + char;
    } else {
      current += char;
    }
  }
  if (current) parts.push(current);
  return parts.join('\r\n');
}

export function buildCalendar(events: IcsEvent[], calendarName = 'Komon'): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Komon//Community Management//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    'X-WR-TIMEZONE:Europe/Berlin',
  ];

  for (const event of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${event.uid}`);
    lines.push(`DTSTAMP:${toUtcStamp(event.updatedAt ?? event.createdAt ?? new Date())}`);

    if (event.allDay) {
      const endExclusive = new Date(event.end.getTime() + 24 * 3600_000);
      lines.push(`DTSTART;VALUE=DATE:${toDateValue(event.start)}`);
      lines.push(`DTEND;VALUE=DATE:${toDateValue(endExclusive)}`);
    } else {
      lines.push(`DTSTART:${toUtcStamp(event.start)}`);
      lines.push(`DTEND:${toUtcStamp(event.end)}`);
    }

    lines.push(`SUMMARY:${escapeText(event.title)}`);
    if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
    if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
    if (event.url) lines.push(`URL:${event.url}`);
    if (event.recurrence) lines.push(`RRULE:${event.recurrence}`);
    if (event.organizer) {
      const cn = event.organizer.name ? `;CN=${escapeText(event.organizer.name)}` : '';
      lines.push(`ORGANIZER${cn}:mailto:${event.organizer.email}`);
    }
    lines.push(`STATUS:${event.status ?? 'CONFIRMED'}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
