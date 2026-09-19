import { describe, expect, it } from 'vitest';

import { guessMimeType, isInlineSafe, safeFileName } from '@/lib/storage';

describe('safeFileName', () => {
  it('entfernt Pfadbestandteile', () => {
    expect(safeFileName('../../etc/passwd')).toBe('passwd');
    expect(safeFileName('/absolut/pfad/datei.pdf')).toBe('datei.pdf');
  });

  it('behält Umlaute', () => {
    expect(safeFileName('Übersicht Beiträge.pdf')).toBe('Übersicht Beiträge.pdf');
  });

  it('ersetzt ungewöhnliche Zeichen', () => {
    expect(safeFileName('datei*name?.txt')).toBe('datei_name_.txt');
  });

  it('gibt einen Ersatznamen zurück, wenn nichts übrig bleibt', () => {
    expect(safeFileName('///')).toBe('datei');
  });

  it('kürzt sehr lange Namen', () => {
    expect(safeFileName(`${'a'.repeat(300)}.txt`).length).toBeLessThanOrEqual(180);
  });
});

describe('guessMimeType', () => {
  it('erkennt gängige Endungen', () => {
    expect(guessMimeType('protokoll.pdf')).toBe('application/pdf');
    expect(guessMimeType('Liste.CSV')).toBe('text/csv; charset=utf-8');
  });

  it('fällt auf einen allgemeinen Typ zurück', () => {
    expect(guessMimeType('datei.unbekannt')).toBe('application/octet-stream');
  });
});

describe('isInlineSafe', () => {
  it('zeigt Bilder und PDF im Browser', () => {
    expect(isInlineSafe('image/png')).toBe(true);
    expect(isInlineSafe('application/pdf')).toBe(true);
  });

  it('bietet HTML und SVG zum Herunterladen an', () => {
    expect(isInlineSafe('text/html')).toBe(false);
    expect(isInlineSafe('image/svg+xml')).toBe(false);
  });
});
