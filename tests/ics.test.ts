import { describe, expect, it } from 'vitest';

import { buildCalendar } from '@/lib/ics';

const start = new Date('2026-09-19T16:00:00.000Z');
const end = new Date('2026-09-19T18:30:00.000Z');

describe('buildCalendar', () => {
  it('erzeugt ein gültiges Grundgerüst', () => {
    const ics = buildCalendar([]);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('VERSION:2.0');
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
  });

  it('nutzt Zeilenenden nach dem Standard', () => {
    expect(buildCalendar([]).includes('\r\n')).toBe(true);
  });

  it('schreibt Beginn und Ende in koordinierter Weltzeit', () => {
    const ics = buildCalendar([
      { uid: 'a@komon', title: 'Sitzung', start, end, updatedAt: start },
    ]);
    expect(ics).toContain('DTSTART:20260919T160000Z');
    expect(ics).toContain('DTEND:20260919T183000Z');
  });

  it('schreibt ganztägige Termine als Datum und zählt das Ende weiter', () => {
    const ics = buildCalendar([
      { uid: 'b@komon', title: 'Frist', start, end, allDay: true, updatedAt: start },
    ]);
    expect(ics).toContain('DTSTART;VALUE=DATE:20260919');
    expect(ics).toContain('DTEND;VALUE=DATE:20260920');
  });

  it('maskiert Sonderzeichen im Text', () => {
    const ics = buildCalendar([
      {
        uid: 'c@komon',
        title: 'Probe; mit Komma, und Zeilenumbruch',
        description: 'Zeile eins\nZeile zwei',
        start,
        end,
        updatedAt: start,
      },
    ]);
    expect(ics).toContain('SUMMARY:Probe\; mit Komma\\, und Zeilenumbruch');
    expect(ics).toContain('DESCRIPTION:Zeile eins\\nZeile zwei');
  });

  it('übernimmt Wiederholungsregeln und den Status', () => {
    const ics = buildCalendar([
      {
        uid: 'd@komon',
        title: 'Monatliche Sitzung',
        start,
        end,
        recurrence: 'FREQ=MONTHLY;BYDAY=1MO',
        status: 'CANCELLED',
        updatedAt: start,
      },
    ]);
    expect(ics).toContain('RRULE:FREQ=MONTHLY;BYDAY=1MO');
    expect(ics).toContain('STATUS:CANCELLED');
  });

  it('faltet zu lange Zeilen', () => {
    const ics = buildCalendar([
      { uid: 'e@komon', title: 'x'.repeat(200), start, end, updatedAt: start },
    ]);
    for (const line of ics.split('\r\n')) {
      expect(Buffer.byteLength(line, 'utf8')).toBeLessThanOrEqual(75);
    }
  });

  it('nennt die verantwortliche Person', () => {
    const ics = buildCalendar([
      {
        uid: 'f@komon',
        title: 'Sitzung',
        start,
        end,
        organizer: { name: 'Mira Lindqvist', email: 'mira@example.org' },
        updatedAt: start,
      },
    ]);
    expect(ics).toContain('ORGANIZER;CN=Mira Lindqvist:mailto:mira@example.org');
  });
});
