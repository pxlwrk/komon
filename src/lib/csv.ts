/** Kleine Helfer fuer den Import und Export von Teilnehmendenlisten. */

/** Setzt einen Wert so, dass er in jeder Tabellenkalkulation korrekt ankommt. */
export function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = value instanceof Date ? value.toISOString() : String(value);
  if (/[",;\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(rows: Record<string, unknown>[], columns?: string[]): string {
  if (rows.length === 0) return '';
  const header = columns ?? Object.keys(rows[0]);
  const lines = [header.map(escapeCsvValue).join(';')];
  for (const row of rows) {
    lines.push(header.map((key) => escapeCsvValue(row[key])).join(';'));
  }
  // Byte Order Mark, damit Excel die Umlaute richtig liest.
  return '﻿' + lines.join('\r\n') + '\r\n';
}

/**
 * Liest eine CSV-Datei mit Semikolon oder Komma als Trennzeichen und
 * beruecksichtigt Anfuehrungszeichen sowie Zeilenumbrueche in Feldern.
 */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, '');
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char === '\r') {
      // Wird zusammen mit dem folgenden Zeilenumbruch behandelt.
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((entry) => entry.some((value) => value.trim().length > 0));
}

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  const tabs = (firstLine.match(/\t/g) ?? []).length;
  if (tabs > semicolons && tabs > commas) return '\t';
  return commas > semicolons ? ',' : ';';
}

/** Wandelt eine Kopfzeile in normalisierte Schluessel um. */
export function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
