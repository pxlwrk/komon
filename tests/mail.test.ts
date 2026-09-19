import { describe, expect, it } from 'vitest';

import { formatAddress, isValidEmail, normalizeEmail, parseAddress, renderTemplate, textToHtml } from '@/lib/mail';

describe('parseAddress', () => {
  it('trennt Namen und Adresse', () => {
    expect(parseAddress('Anna Berger <Anna.Berger@Example.org>')).toEqual({
      name: 'Anna Berger',
      address: 'anna.berger@example.org',
    });
  });

  it('kommt mit einer blanken Adresse zurecht', () => {
    expect(parseAddress('  anna@example.org ')).toEqual({ name: null, address: 'anna@example.org' });
  });

  it('entfernt Anführungszeichen um den Namen', () => {
    expect(parseAddress('"Berger, Anna" <anna@example.org>').name).toBe('Berger, Anna');
  });
});

describe('formatAddress', () => {
  it('setzt den Namen in Anführungszeichen', () => {
    expect(formatAddress('Anna Berger', 'anna@example.org')).toBe('"Anna Berger" <anna@example.org>');
  });

  it('gibt ohne Namen nur die Adresse zurück', () => {
    expect(formatAddress(null, 'anna@example.org')).toBe('anna@example.org');
  });
});

describe('isValidEmail', () => {
  it('erkennt gültige Adressen', () => {
    expect(isValidEmail('anna@example.org')).toBe(true);
  });

  it('weist unvollständige Adressen ab', () => {
    expect(isValidEmail('anna@example')).toBe(false);
    expect(isValidEmail('anna')).toBe(false);
    expect(isValidEmail('anna @example.org')).toBe(false);
  });
});

describe('normalizeEmail', () => {
  it('vereinheitlicht Groß- und Kleinschreibung', () => {
    expect(normalizeEmail('  Anna@Example.ORG ')).toBe('anna@example.org');
  });
});

describe('renderTemplate', () => {
  it('ersetzt bekannte Platzhalter', () => {
    expect(renderTemplate('Hallo {{vorname}}', { vorname: 'Anna' })).toBe('Hallo Anna');
  });

  it('lässt unbekannte Platzhalter stehen', () => {
    expect(renderTemplate('Hallo {{unbekannt}}', { vorname: 'Anna' })).toBe('Hallo {{unbekannt}}');
  });

  it('verträgt Leerzeichen in den Klammern', () => {
    expect(renderTemplate('Hallo {{ vorname }}', { vorname: 'Anna' })).toBe('Hallo Anna');
  });
});

describe('textToHtml', () => {
  it('maskiert spitze Klammern', () => {
    expect(textToHtml('<script>')).toContain('&lt;script&gt;');
  });

  it('macht aus Absätzen eigene Blöcke', () => {
    const html = textToHtml('Erster Absatz\n\nZweiter Absatz');
    expect(html.match(/<p /g)?.length).toBe(2);
  });

  it('verlinkt Internetadressen', () => {
    expect(textToHtml('Siehe https://example.org')).toContain('<a href="https://example.org"');
  });
});
