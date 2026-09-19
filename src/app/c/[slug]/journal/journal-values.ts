/**
 * Vorbelegung und Typ des Journalformulars.
 *
 * Getrennt vom Formular, damit Server Components darauf zugreifen können.
 */

export type JournalFormValues = {
  title: string;
  summary: string | null;
  content: string;
  type: string;
  status: string;
  channel: string;
  visibility: string;
  plannedAt: string;
  eventId: string;
  tags: string;
};

export function defaultJournalValues(): JournalFormValues {
  return {
    title: '',
    summary: null,
    content: '',
    type: 'NOTE',
    status: 'DRAFT',
    channel: 'INTERNAL',
    visibility: 'COMMUNITY',
    plannedAt: '',
    eventId: '',
    tags: '',
  };
}
