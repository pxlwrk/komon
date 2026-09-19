import { describe, expect, it } from 'vitest';

import { formatBytes, initials, slugify } from '@/lib/format';

describe('slugify', () => {
  it('ersetzt Umlaute lesbar', () => {
    expect(slugify('Jahresversammlung für Mitglieder')).toBe('jahresversammlung-fuer-mitglieder');
    expect(slugify('Größe')).toBe('groesse');
    expect(slugify('Straße')).toBe('strasse');
  });

  it('entfernt Sonderzeichen und mehrfache Trennstriche', () => {
    expect(slugify('Hallo!!!   Welt???')).toBe('hallo-welt');
  });

  it('schneidet Trennstriche an den Rändern ab', () => {
    expect(slugify('  -- Test -- ')).toBe('test');
  });

  it('begrenzt die Länge', () => {
    expect(slugify('a'.repeat(200)).length).toBeLessThanOrEqual(80);
  });
});

describe('formatBytes', () => {
  it('gibt kleine Größen in Byte an', () => {
    expect(formatBytes(512)).toBe('512 B');
  });

  it('rechnet in größere Einheiten um', () => {
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });

  it('lässt bei großen Zahlen die Nachkommastelle weg', () => {
    expect(formatBytes(20 * 1024 * 1024)).toBe('20 MB');
  });
});

describe('initials', () => {
  it('bildet Anfangsbuchstaben in Großschreibung', () => {
    expect(initials('anna', 'berger')).toBe('AB');
  });
});
