/**
 * Berechtigungen und Rollenvorlagen.
 *
 * Eine Rolle ist eine benannte Sammlung von Berechtigungsschluesseln. Jede
 * Community erhaelt beim Anlegen die Systemrollen aus ROLE_PRESETS und kann
 * eigene Rollen ergaenzen.
 */

export const PERMISSIONS = {
  'community.view': 'Community ansehen',
  'community.manage': 'Community-Einstellungen bearbeiten',

  'member.view': 'Teilnehmende ansehen',
  'member.create': 'Teilnehmende anlegen',
  'member.update': 'Stammdaten bearbeiten',
  'member.delete': 'Teilnehmende entfernen',
  'member.export': 'Teilnehmendenliste exportieren',

  'group.view': 'Gruppen ansehen',
  'group.manage': 'Gruppen verwalten',

  'role.view': 'Rollen ansehen',
  'role.manage': 'Rollen und Rechte verwalten',
  'account.manage': 'Benutzerkonten und Einladungen verwalten',

  'mail.view': 'Nachrichten ansehen',
  'mail.compose': 'Nachrichten verfassen',
  'mail.send': 'Nachrichten versenden',
  'mail.template.manage': 'Vorlagen verwalten',

  'list.view': 'Mailinglisten ansehen',
  'list.manage': 'Mailinglisten verwalten',
  'list.moderate': 'Beitraege moderieren',
  'list.archive.view': 'Listenarchiv ansehen',

  'file.view': 'Dateien ansehen',
  'file.upload': 'Dateien hochladen',
  'file.manage': 'Ordner und Dateien verwalten',

  'event.view': 'Events ansehen',
  'event.manage': 'Events planen und bearbeiten',
  'event.invite': 'Einladungen versenden',
  'event.checkin': 'Teilnahme erfassen',
  'event.debrief': 'Nachbereitung pflegen',

  'calendar.view': 'Termine ansehen',
  'calendar.manage': 'Termine verwalten',

  'journal.view': 'Journal ansehen',
  'journal.write': 'Journaleintraege schreiben',
  'journal.publish': 'Journaleintraege veroeffentlichen',

  'audit.view': 'Protokoll ansehen',
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export function isPermission(value: string): value is Permission {
  return value in PERMISSIONS;
}

/** Gruppierung fuer die Rechteverwaltung in der Oberflaeche. */
export const PERMISSION_GROUPS: { title: string; permissions: Permission[] }[] = [
  {
    title: 'Community',
    permissions: ['community.view', 'community.manage', 'audit.view'],
  },
  {
    title: 'Teilnehmende',
    permissions: [
      'member.view',
      'member.create',
      'member.update',
      'member.delete',
      'member.export',
      'group.view',
      'group.manage',
    ],
  },
  {
    title: 'Benutzer und Rechte',
    permissions: ['role.view', 'role.manage', 'account.manage'],
  },
  {
    title: 'Kommunikation',
    permissions: ['mail.view', 'mail.compose', 'mail.send', 'mail.template.manage'],
  },
  {
    title: 'Mailinglisten',
    permissions: ['list.view', 'list.manage', 'list.moderate', 'list.archive.view'],
  },
  {
    title: 'Dateiablage',
    permissions: ['file.view', 'file.upload', 'file.manage'],
  },
  {
    title: 'Events',
    permissions: ['event.view', 'event.manage', 'event.invite', 'event.checkin', 'event.debrief'],
  },
  {
    title: 'Termine und Journal',
    permissions: [
      'calendar.view',
      'calendar.manage',
      'journal.view',
      'journal.write',
      'journal.publish',
    ],
  },
];

const MEMBER_BASE: Permission[] = [
  'community.view',
  'member.view',
  'group.view',
  'list.view',
  'list.archive.view',
  'file.view',
  'event.view',
  'calendar.view',
  'journal.view',
];

export type RolePreset = {
  key: string;
  name: string;
  description: string;
  rank: number;
  permissions: Permission[];
};

export const ROLE_PRESETS: RolePreset[] = [
  {
    key: 'owner',
    name: 'Leitung',
    description: 'Vollzugriff auf alle Bereiche der Community.',
    rank: 10,
    permissions: [...ALL_PERMISSIONS],
  },
  {
    key: 'admin',
    name: 'Verwaltung',
    description: 'Verwaltet Teilnehmende, Kommunikation, Dateien und Events.',
    rank: 20,
    permissions: ALL_PERMISSIONS.filter((p) => p !== 'community.manage'),
  },
  {
    key: 'moderator',
    name: 'Moderation',
    description: 'Betreut Mailinglisten und das Journal.',
    rank: 30,
    permissions: [
      ...MEMBER_BASE,
      'mail.view',
      'mail.compose',
      'list.moderate',
      'journal.write',
      'journal.publish',
      'file.upload',
    ],
  },
  {
    key: 'organizer',
    name: 'Eventteam',
    description: 'Plant Events, lädt ein und pflegt die Nachbereitung.',
    rank: 40,
    permissions: [
      ...MEMBER_BASE,
      'event.manage',
      'event.invite',
      'event.checkin',
      'event.debrief',
      'calendar.manage',
      'file.upload',
      'mail.view',
      'mail.compose',
      'member.export',
    ],
  },
  {
    key: 'editor',
    name: 'Redaktion',
    description: 'Pflegt das Content-Journal und den Redaktionsplan.',
    rank: 50,
    permissions: [
      ...MEMBER_BASE,
      'journal.write',
      'journal.publish',
      'calendar.manage',
      'file.upload',
      'mail.view',
      'mail.compose',
    ],
  },
  {
    key: 'member',
    name: 'Mitglied',
    description: 'Liest Inhalte und nimmt an Events teil.',
    rank: 60,
    permissions: [...MEMBER_BASE],
  },
  {
    key: 'guest',
    name: 'Gast',
    description: 'Eingeschraenkter Lesezugriff auf Termine und Events.',
    rank: 70,
    permissions: ['community.view', 'event.view', 'calendar.view'],
  },
];

export function presetByKey(key: string): RolePreset | undefined {
  return ROLE_PRESETS.find((preset) => preset.key === key);
}

/** Liest die in der Datenbank als JSON abgelegten Berechtigungen. */
export function parsePermissions(raw: string | null | undefined): Permission[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is Permission => typeof value === 'string' && isPermission(value));
  } catch {
    return [];
  }
}

export function serializePermissions(permissions: Permission[]): string {
  const unique = Array.from(new Set(permissions)).filter(isPermission);
  unique.sort();
  return JSON.stringify(unique);
}
