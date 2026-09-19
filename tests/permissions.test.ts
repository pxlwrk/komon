import { describe, expect, it } from 'vitest';

import {
  ALL_PERMISSIONS,
  ROLE_PRESETS,
  isPermission,
  parsePermissions,
  presetByKey,
  serializePermissions,
} from '@/lib/permissions';

describe('Berechtigungen', () => {
  it('erkennt gültige Schlüssel', () => {
    expect(isPermission('member.view')).toBe(true);
    expect(isPermission('member.erfinden')).toBe(false);
  });

  it('speichert und liest Berechtigungen verlustfrei', () => {
    const raw = serializePermissions(['member.view', 'mail.send', 'member.view']);
    const parsed = parsePermissions(raw);
    expect(parsed).toEqual(['mail.send', 'member.view']);
  });

  it('übergeht unbekannte Einträge beim Lesen', () => {
    expect(parsePermissions('["member.view","quatsch"]')).toEqual(['member.view']);
  });

  it('verträgt fehlerhaftes JSON', () => {
    expect(parsePermissions('kein json')).toEqual([]);
    expect(parsePermissions(null)).toEqual([]);
  });
});

describe('Rollenvorlagen', () => {
  it('gibt der Leitung alle Rechte', () => {
    const owner = presetByKey('owner');
    expect(owner?.permissions).toHaveLength(ALL_PERMISSIONS.length);
  });

  it('verwendet ausschließlich bekannte Berechtigungen', () => {
    for (const preset of ROLE_PRESETS) {
      for (const permission of preset.permissions) {
        expect(isPermission(permission)).toBe(true);
      }
    }
  });

  it('gibt dem Gastzugang keine Schreibrechte', () => {
    const guest = presetByKey('guest');
    const writing = guest?.permissions.filter((permission) =>
      /\.(create|update|delete|manage|send|write|publish|invite|upload|moderate)$/.test(permission),
    );
    expect(writing).toEqual([]);
  });

  it('vergibt eindeutige Schlüssel', () => {
    const keys = ROLE_PRESETS.map((preset) => preset.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
