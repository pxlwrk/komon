/**
 * Vorbelegung und Typ des Eventformulars.
 *
 * Bewusst getrennt vom Formular selbst: Server Components dürfen aus einem
 * Modul mit "use client" nur Komponenten beziehen, keine gewöhnlichen
 * Funktionen.
 */

export type EventFormValues = {
  title: string;
  summary: string | null;
  description: string | null;
  status: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  locationName: string | null;
  locationAddress: string | null;
  onlineUrl: string | null;
  capacity: string;
  waitlistEnabled: boolean;
  allowGuests: boolean;
  registrationClosesAt: string;
  visibility: string;
  organizerId: string;
  plannedBudget: string;
};

/** Wandelt ein Datum in den Wert eines datetime-local-Feldes. */
export function toLocalInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Ein neues Event startet vorbelegt in zwei Wochen um 18 Uhr. */
export function defaultEventValues(): EventFormValues {
  const start = new Date();
  start.setDate(start.getDate() + 14);
  start.setHours(18, 0, 0, 0);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);

  return {
    title: '',
    summary: null,
    description: null,
    status: 'PLANNING',
    startAt: toLocalInput(start),
    endAt: toLocalInput(end),
    allDay: false,
    locationName: null,
    locationAddress: null,
    onlineUrl: null,
    capacity: '',
    waitlistEnabled: true,
    allowGuests: false,
    registrationClosesAt: '',
    visibility: 'COMMUNITY',
    organizerId: '',
    plannedBudget: '',
  };
}
