import { prisma } from '@/lib/prisma';

export type CalendarItem = {
  id: string;
  kind: 'EVENT' | 'ENTRY' | 'JOURNAL';
  title: string;
  description: string | null;
  location: string | null;
  start: Date;
  end: Date;
  allDay: boolean;
  category: string;
  status: string | null;
  href: string | null;
  recurrence: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Fuehrt Events, freie Termine und geplante Journaleintraege zu einer Ansicht
 * zusammen, damit der Kalender alle Vorhaben einer Community zeigt.
 */
export async function collectCalendarItems(params: {
  communityId: string;
  slug: string;
  from: Date;
  to: Date;
  includeStaff: boolean;
  personId: string;
  includeJournal: boolean;
}): Promise<CalendarItem[]> {
  const { communityId, slug, from, to } = params;

  const [events, entries, journal] = await Promise.all([
    prisma.event.findMany({
      where: {
        communityId,
        startAt: { lte: to },
        endAt: { gte: from },
        status: { not: 'DRAFT' },
      },
      select: {
        id: true,
        title: true,
        summary: true,
        locationName: true,
        locationAddress: true,
        onlineUrl: true,
        startAt: true,
        endAt: true,
        allDay: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.calendarEntry.findMany({
      where: {
        communityId,
        startAt: { lte: to },
        endAt: { gte: from },
        eventId: null,
        OR: [
          { visibility: 'COMMUNITY' },
          ...(params.includeStaff ? [{ visibility: 'STAFF' as const }] : []),
          { visibility: 'PRIVATE', ownerId: params.personId },
        ],
      },
    }),
    params.includeJournal
      ? prisma.journalEntry.findMany({
          where: {
            communityId,
            plannedAt: { gte: from, lte: to },
            status: { in: ['IDEA', 'DRAFT', 'IN_REVIEW', 'SCHEDULED'] },
          },
          select: {
            id: true,
            title: true,
            summary: true,
            plannedAt: true,
            status: true,
            channel: true,
            createdAt: true,
            updatedAt: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const items: CalendarItem[] = [];

  for (const event of events) {
    items.push({
      id: `event-${event.id}`,
      kind: 'EVENT',
      title: event.title,
      description: event.summary,
      location:
        event.onlineUrl ?? [event.locationName, event.locationAddress].filter(Boolean).join(', ') ?? null,
      start: event.startAt,
      end: event.endAt,
      allDay: event.allDay,
      category: 'EVENT',
      status: event.status,
      href: `/c/${slug}/events/${event.id}`,
      recurrence: null,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    });
  }

  for (const entry of entries) {
    items.push({
      id: `entry-${entry.id}`,
      kind: 'ENTRY',
      title: entry.title,
      description: entry.description,
      location: entry.location,
      start: entry.startAt,
      end: entry.endAt,
      allDay: entry.allDay,
      category: entry.kind,
      status: null,
      href: null,
      recurrence: entry.recurrence,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    });
  }

  for (const entry of journal) {
    if (!entry.plannedAt) continue;
    items.push({
      id: `journal-${entry.id}`,
      kind: 'JOURNAL',
      title: entry.title,
      description: entry.summary,
      location: null,
      start: entry.plannedAt,
      end: entry.plannedAt,
      allDay: true,
      category: 'PUBLICATION',
      status: entry.status,
      href: `/c/${slug}/journal/${entry.id}`,
      recurrence: null,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    });
  }

  items.sort((a, b) => a.start.getTime() - b.start.getTime());
  return items;
}

/** Erster Tag des Monats in der uebergebenen Zeitzone. */
export function monthRange(year: number, month: number): { from: Date; to: Date } {
  const from = new Date(year, month, 1, 0, 0, 0, 0);
  const to = new Date(year, month + 1, 0, 23, 59, 59, 999);
  return { from, to };
}

/**
 * Baut das Raster einer Monatsansicht, beginnend am Montag der ersten Woche.
 */
export function buildMonthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // Montag als erster Tag
  const start = new Date(year, month, 1 - offset);

  const days: Date[] = [];
  for (let index = 0; index < 42; index += 1) {
    days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
  }
  return days;
}
