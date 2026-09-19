/**
 * Zentrale Definition aller aufzaehlbaren Werte.
 *
 * SQLite kennt in Prisma keine Enums. Damit die Werte trotzdem an genau einer
 * Stelle gepflegt werden, stehen sie hier zusammen mit den Beschriftungen fuer
 * die Oberflaeche.
 */

export type LabelMap<T extends string> = Record<T, string>;

function keysOf<T extends string>(map: LabelMap<T>): T[] {
  return Object.keys(map) as T[];
}

// --- Personen --------------------------------------------------------------

export const PERSON_STATUS = {
  ACTIVE: 'Aktiv',
  INACTIVE: 'Inaktiv',
  ARCHIVED: 'Archiviert',
} as const;
export type PersonStatus = keyof typeof PERSON_STATUS;
export const personStatusValues = keysOf(PERSON_STATUS);

export const SALUTATION = {
  KEINE: 'Ohne Anrede',
  FRAU: 'Frau',
  HERR: 'Herr',
  DIVERS: 'Neutrale Anrede',
} as const;
export type Salutation = keyof typeof SALUTATION;
export const salutationValues = keysOf(SALUTATION);

export const EMAIL_ADDRESS_STATUS = {
  ACTIVE: 'Aktiv',
  BOUNCING: 'Zustellprobleme',
  DISABLED: 'Deaktiviert',
} as const;
export type EmailAddressStatus = keyof typeof EMAIL_ADDRESS_STATUS;
export const emailAddressStatusValues = keysOf(EMAIL_ADDRESS_STATUS);

// --- Mitgliedschaften ------------------------------------------------------

export const MEMBERSHIP_STATUS = {
  ACTIVE: 'Aktiv',
  PENDING: 'Aufnahme offen',
  PAUSED: 'Ruhend',
  LEFT: 'Ausgetreten',
  BLOCKED: 'Gesperrt',
} as const;
export type MembershipStatus = keyof typeof MEMBERSHIP_STATUS;
export const membershipStatusValues = keysOf(MEMBERSHIP_STATUS);

export const MAIL_PREFERENCE = {
  REGULAR: 'Einzelne Nachrichten',
  DIGEST: 'Sammelausgabe',
  NONE: 'Keine Zustellung',
} as const;
export type MailPreference = keyof typeof MAIL_PREFERENCE;
export const mailPreferenceValues = keysOf(MAIL_PREFERENCE);

export const COMMUNITY_STATUS = {
  ACTIVE: 'Aktiv',
  ARCHIVED: 'Archiviert',
} as const;
export type CommunityStatus = keyof typeof COMMUNITY_STATUS;
export const communityStatusValues = keysOf(COMMUNITY_STATUS);

export const GROUP_TYPE = {
  STATIC: 'Feste Zuordnung',
  SMART: 'Regelbasiert',
} as const;
export type GroupType = keyof typeof GROUP_TYPE;
export const groupTypeValues = keysOf(GROUP_TYPE);

// --- Stammdatenfelder ------------------------------------------------------

export const CUSTOM_FIELD_TYPE = {
  TEXT: 'Text',
  LONGTEXT: 'Mehrzeiliger Text',
  NUMBER: 'Zahl',
  DATE: 'Datum',
  BOOLEAN: 'Ja oder Nein',
  SELECT: 'Auswahl',
  MULTISELECT: 'Mehrfachauswahl',
  EMAIL: 'E-Mail-Adresse',
  PHONE: 'Telefonnummer',
  URL: 'Internetadresse',
} as const;
export type CustomFieldType = keyof typeof CUSTOM_FIELD_TYPE;
export const customFieldTypeValues = keysOf(CUSTOM_FIELD_TYPE);

export const CUSTOM_FIELD_VISIBILITY = {
  STAFF: 'Nur Verwaltung',
  MEMBER: 'Alle Mitglieder',
  SELF: 'Nur die Person selbst',
} as const;
export type CustomFieldVisibility = keyof typeof CUSTOM_FIELD_VISIBILITY;
export const customFieldVisibilityValues = keysOf(CUSTOM_FIELD_VISIBILITY);

// --- E-Mail ----------------------------------------------------------------

export const EMAIL_KIND = {
  CAMPAIGN: 'Rundschreiben',
  TRANSACTIONAL: 'Systemnachricht',
  LIST_DISTRIBUTION: 'Listenverteilung',
  EVENT_INVITATION: 'Event-Einladung',
  EVENT_REMINDER: 'Event-Erinnerung',
  EVENT_FOLLOWUP: 'Event-Nachbereitung',
} as const;
export type EmailKind = keyof typeof EMAIL_KIND;
export const emailKindValues = keysOf(EMAIL_KIND);

export const EMAIL_STATUS = {
  DRAFT: 'Entwurf',
  SCHEDULED: 'Geplant',
  QUEUED: 'In der Warteschlange',
  SENDING: 'Wird versendet',
  SENT: 'Versendet',
  FAILED: 'Fehlgeschlagen',
  CANCELLED: 'Abgebrochen',
} as const;
export type EmailStatus = keyof typeof EMAIL_STATUS;
export const emailStatusValues = keysOf(EMAIL_STATUS);

export const DELIVERY_STATUS = {
  QUEUED: 'Wartet',
  SENDING: 'Wird gesendet',
  SENT: 'Zugestellt',
  FAILED: 'Fehlgeschlagen',
  BOUNCED: 'Unzustellbar',
  SKIPPED: 'Uebersprungen',
} as const;
export type DeliveryStatus = keyof typeof DELIVERY_STATUS;
export const deliveryStatusValues = keysOf(DELIVERY_STATUS);

// --- Mailinglisten ---------------------------------------------------------

export const LIST_TYPE = {
  DISCUSSION: 'Diskussionsliste',
  ANNOUNCE: 'Ankuendigungsliste',
} as const;
export type ListType = keyof typeof LIST_TYPE;
export const listTypeValues = keysOf(LIST_TYPE);

export const POSTING_POLICY = {
  OPEN: 'Alle duerfen schreiben',
  SUBSCRIBERS: 'Nur eingetragene Adressen',
  MEMBERS: 'Alle Mitglieder der Community',
  MODERATORS: 'Nur Moderation und Leitung',
} as const;
export type PostingPolicy = keyof typeof POSTING_POLICY;
export const postingPolicyValues = keysOf(POSTING_POLICY);

export const MODERATION_POLICY = {
  NONE: 'Keine Moderation',
  NON_SUBSCRIBERS: 'Fremde Absender moderieren',
  ALL: 'Alle Beitraege moderieren',
} as const;
export type ModerationPolicy = keyof typeof MODERATION_POLICY;
export const moderationPolicyValues = keysOf(MODERATION_POLICY);

export const SUBSCRIPTION_POLICY = {
  OPEN: 'Eintragen ohne Bestaetigung',
  CONFIRM: 'Bestaetigung per E-Mail',
  APPROVAL: 'Freigabe durch die Moderation',
  CLOSED: 'Nur durch die Verwaltung',
} as const;
export type SubscriptionPolicy = keyof typeof SUBSCRIPTION_POLICY;
export const subscriptionPolicyValues = keysOf(SUBSCRIPTION_POLICY);

export const REPLY_TO_MODE = {
  LIST: 'Antwort an die Liste',
  SENDER: 'Antwort an die absendende Person',
} as const;
export type ReplyToMode = keyof typeof REPLY_TO_MODE;
export const replyToModeValues = keysOf(REPLY_TO_MODE);

export const ARCHIVE_POLICY = {
  PUBLIC: 'Oeffentlich',
  MEMBERS: 'Alle Mitglieder',
  SUBSCRIBERS: 'Nur eingetragene Adressen',
  PRIVATE: 'Nur Moderation und Leitung',
} as const;
export type ArchivePolicy = keyof typeof ARCHIVE_POLICY;
export const archivePolicyValues = keysOf(ARCHIVE_POLICY);

export const SUBSCRIPTION_ROLE = {
  SUBSCRIBER: 'Eingetragen',
  MODERATOR: 'Moderation',
  OWNER: 'Listenleitung',
} as const;
export type SubscriptionRole = keyof typeof SUBSCRIPTION_ROLE;
export const subscriptionRoleValues = keysOf(SUBSCRIPTION_ROLE);

export const SUBSCRIPTION_STATUS = {
  PENDING: 'Freigabe offen',
  ACTIVE: 'Aktiv',
  UNSUBSCRIBED: 'Ausgetragen',
  BOUNCING: 'Zustellprobleme',
  BLOCKED: 'Gesperrt',
} as const;
export type SubscriptionStatus = keyof typeof SUBSCRIPTION_STATUS;
export const subscriptionStatusValues = keysOf(SUBSCRIPTION_STATUS);

export const LIST_MESSAGE_STATUS = {
  PENDING: 'Wartet auf Freigabe',
  APPROVED: 'Freigegeben',
  REJECTED: 'Abgelehnt',
  DISTRIBUTED: 'Verteilt',
  DISCARDED: 'Verworfen',
} as const;
export type ListMessageStatus = keyof typeof LIST_MESSAGE_STATUS;
export const listMessageStatusValues = keysOf(LIST_MESSAGE_STATUS);

// --- Dateiablage -----------------------------------------------------------

export const FOLDER_VISIBILITY = {
  COMMUNITY: 'Alle Mitglieder',
  RESTRICTED: 'Nur ausgewaehlte Rollen',
} as const;
export type FolderVisibility = keyof typeof FOLDER_VISIBILITY;
export const folderVisibilityValues = keysOf(FOLDER_VISIBILITY);

export const ACCESS_LEVEL = {
  READ: 'Lesen',
  WRITE: 'Lesen und Hochladen',
  MANAGE: 'Vollzugriff',
} as const;
export type AccessLevel = keyof typeof ACCESS_LEVEL;
export const accessLevelValues = keysOf(ACCESS_LEVEL);

// --- Events ----------------------------------------------------------------

export const EVENT_STATUS = {
  DRAFT: 'Entwurf',
  PLANNING: 'In Planung',
  PUBLISHED: 'Veroeffentlicht',
  REGISTRATION_CLOSED: 'Anmeldung geschlossen',
  RUNNING: 'Laeuft',
  COMPLETED: 'Abgeschlossen',
  CANCELLED: 'Abgesagt',
} as const;
export type EventStatus = keyof typeof EVENT_STATUS;
export const eventStatusValues = keysOf(EVENT_STATUS);

export const EVENT_VISIBILITY = {
  COMMUNITY: 'Alle Mitglieder',
  GROUP: 'Ausgewaehlte Gruppen',
  INVITE_ONLY: 'Nur mit Einladung',
  PUBLIC: 'Oeffentlich',
} as const;
export type EventVisibility = keyof typeof EVENT_VISIBILITY;
export const eventVisibilityValues = keysOf(EVENT_VISIBILITY);

export const PARTICIPATION_SOURCE = {
  INVITED: 'Eingeladen',
  SELF_REGISTERED: 'Selbst angemeldet',
  ADDED_BY_STAFF: 'Durch die Verwaltung erfasst',
} as const;
export type ParticipationSource = keyof typeof PARTICIPATION_SOURCE;
export const participationSourceValues = keysOf(PARTICIPATION_SOURCE);

export const PARTICIPATION_STATUS = {
  INVITED: 'Eingeladen',
  ACCEPTED: 'Zugesagt',
  DECLINED: 'Abgesagt',
  TENTATIVE: 'Unter Vorbehalt',
  WAITLIST: 'Warteliste',
  CANCELLED: 'Zurueckgezogen',
} as const;
export type ParticipationStatus = keyof typeof PARTICIPATION_STATUS;
export const participationStatusValues = keysOf(PARTICIPATION_STATUS);

export const EVENT_TASK_PHASE = {
  PLANNING: 'Planung',
  EXECUTION: 'Durchfuehrung',
  FOLLOWUP: 'Nachbereitung',
} as const;
export type EventTaskPhase = keyof typeof EVENT_TASK_PHASE;
export const eventTaskPhaseValues = keysOf(EVENT_TASK_PHASE);

export const TASK_STATUS = {
  OPEN: 'Offen',
  IN_PROGRESS: 'In Arbeit',
  DONE: 'Erledigt',
  CANCELLED: 'Verworfen',
} as const;
export type TaskStatus = keyof typeof TASK_STATUS;
export const taskStatusValues = keysOf(TASK_STATUS);

export const EVENT_RESOURCE_KIND = {
  BRIEFING: 'Vorbereitung',
  PRESENTATION: 'Praesentation',
  MINUTES: 'Protokoll',
  PHOTO: 'Bildmaterial',
  OTHER: 'Sonstiges',
} as const;
export type EventResourceKind = keyof typeof EVENT_RESOURCE_KIND;
export const eventResourceKindValues = keysOf(EVENT_RESOURCE_KIND);

// --- Kalender --------------------------------------------------------------

export const CALENDAR_KIND = {
  MEETING: 'Treffen',
  DEADLINE: 'Frist',
  REMINDER: 'Erinnerung',
  PUBLICATION: 'Veroeffentlichung',
  MILESTONE: 'Meilenstein',
  OTHER: 'Sonstiges',
} as const;
export type CalendarKind = keyof typeof CALENDAR_KIND;
export const calendarKindValues = keysOf(CALENDAR_KIND);

export const CALENDAR_VISIBILITY = {
  COMMUNITY: 'Alle Mitglieder',
  STAFF: 'Nur Verwaltung',
  PRIVATE: 'Nur ich',
} as const;
export type CalendarVisibility = keyof typeof CALENDAR_VISIBILITY;
export const calendarVisibilityValues = keysOf(CALENDAR_VISIBILITY);

// --- Content-Journal -------------------------------------------------------

export const JOURNAL_TYPE = {
  NOTE: 'Notiz',
  POST: 'Beitrag',
  NEWSLETTER: 'Newsletter',
  ANNOUNCEMENT: 'Ankuendigung',
  MINUTES: 'Protokoll',
  DECISION: 'Beschluss',
  RETROSPECTIVE: 'Rueckblick',
} as const;
export type JournalType = keyof typeof JOURNAL_TYPE;
export const journalTypeValues = keysOf(JOURNAL_TYPE);

export const JOURNAL_STATUS = {
  IDEA: 'Idee',
  DRAFT: 'Entwurf',
  IN_REVIEW: 'In Abstimmung',
  SCHEDULED: 'Geplant',
  PUBLISHED: 'Veroeffentlicht',
  ARCHIVED: 'Archiviert',
} as const;
export type JournalStatus = keyof typeof JOURNAL_STATUS;
export const journalStatusValues = keysOf(JOURNAL_STATUS);

export const JOURNAL_CHANNEL = {
  INTERNAL: 'Intern',
  WEBSITE: 'Website',
  NEWSLETTER: 'Newsletter',
  MAILINGLIST: 'Mailingliste',
  SOCIAL: 'Soziale Netzwerke',
} as const;
export type JournalChannel = keyof typeof JOURNAL_CHANNEL;
export const journalChannelValues = keysOf(JOURNAL_CHANNEL);

export const JOURNAL_VISIBILITY = {
  STAFF: 'Nur Verwaltung',
  COMMUNITY: 'Alle Mitglieder',
  PUBLIC: 'Oeffentlich',
} as const;
export type JournalVisibility = keyof typeof JOURNAL_VISIBILITY;
export const journalVisibilityValues = keysOf(JOURNAL_VISIBILITY);

/** Liefert die Beschriftung und faellt auf den Rohwert zurueck. */
export function label<T extends string>(map: LabelMap<T>, value: string | null | undefined): string {
  if (!value) return '';
  return (map as Record<string, string>)[value] ?? value;
}
