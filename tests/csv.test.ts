import { describe, expect, it } from 'vitest';

import { escapeCsvValue, normalizeHeader, parseCsv, toCsv } from '@/lib/csv';

describe('escapeCsvValue', () => {
  it('umschließt Werte mit Trennzeichen', () => {
    expect(escapeCsvValue('Berger; Anna')).toBe('"Berger; Anna"');
  });

  it('verdoppelt Anführungszeichen', () => {
    expect(escapeCsvValue('Sie sagte "Hallo"')).toBe('"Sie sagte ""Hallo"""');
  });

  it('gibt leere Werte als leeren Text zurück', () => {
    expect(escapeCsvValue(null)).toBe('');
    expect(escapeCsvValue(undefined)).toBe('');
  });
});

describe('toCsv', () => {
  it('schreibt Kopfzeile und Werte', () => {
    const csv = toCsv([{ Name: 'Berger', Ort: 'Leipzig' }]);
    expect(csv).toContain('Name;Ort');
    expect(csv).toContain('Berger;Leipzig');
  });

  it('beginnt mit einer Byte Order Mark für Tabellenkalkulationen', () => {
    expect(toCsv([{ a: 1 }]).startsWith('﻿')).toBe(true);
  });
});

describe('parseCsv', () => {
  it('liest Semikolon als Trennzeichen', () => {
    const rows = parseCsv('Vorname;Nachname\nAnna;Berger');
    expect(rows).toEqual([
      ['Vorname', 'Nachname'],
      ['Anna', 'Berger'],
    ]);
  });

  it('liest Komma als Trennzeichen', () => {
    const rows = parseCsv('Vorname,Nachname\nAnna,Berger');
    expect(rows[1]).toEqual(['Anna', 'Berger']);
  });

  it('behält Trennzeichen innerhalb von Anführungszeichen', () => {
    const rows = parseCsv('Name;Ort\n"Berger; Anna";Leipzig');
    expect(rows[1]).toEqual(['Berger; Anna', 'Leipzig']);
  });

  it('versteht verdoppelte Anführungszeichen', () => {
    const rows = parseCsv('Text\n"Sie sagte ""Hallo"""');
    expect(rows[1]).toEqual(['Sie sagte "Hallo"']);
  });

  it('entfernt eine führende Byte Order Mark', () => {
    const rows = parseCsv('﻿Vorname;Nachname\nAnna;Berger');
    expect(rows[0][0]).toBe('Vorname');
  });

  it('überspringt leere Zeilen', () => {
    const rows = parseCsv('a;b\n\n1;2\n\n');
    expect(rows).toHaveLength(2);
  });

  it('kommt mit Windows-Zeilenenden zurecht', () => {
    const rows = parseCsv('a;b\r\n1;2\r\n');
    expect(rows[1]).toEqual(['1', '2']);
  });
});

describe('normalizeHeader', () => {
  it('ersetzt Umlaute', () => {
    expect(normalizeHeader('Straße')).toBe('strasse');
    expect(normalizeHeader('Größe')).toBe('groesse');
  });

  it('vereinheitlicht Trennzeichen', () => {
    expect(normalizeHeader('E-Mail Adresse')).toBe('e_mail_adresse');
  });
});
