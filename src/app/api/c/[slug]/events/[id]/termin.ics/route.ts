import { NextResponse } from 'next/server';

import { buildCalendar } from '@/lib/ics';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';

/** Liefert einen einzelnen Termin als iCalendar-Datei. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await params;
  const context = await requirePermission(slug, 'event.view');

  const event = await prisma.event.findFirst({
    where: { id, communityId: context.community.id },
    include: { organizer: { select: { firstName: true, lastName: true, primaryEmail: true } } },
  });

  if (!event) {
    return NextResponse.json({ error: 'Das Event wurde nicht gefunden.' }, { status: 404 });
  }

  const calendar = buildCalendar(
    [
      {
        uid: `event-${event.id}@komon`,
        title: event.title,
        description: event.summary ?? event.description,
        location: event.onlineUrl ?? [event.locationName, event.locationAddress].filter(Boolean).join(', '),
        start: event.startAt,
        end: event.endAt,
        allDay: event.allDay,
        status: event.status === 'CANCELLED' ? 'CANCELLED' : 'CONFIRMED',
        organizer: event.organizer
          ? {
              name: `${event.organizer.firstName} ${event.organizer.lastName}`.trim(),
              email: event.organizer.primaryEmail,
            }
          : null,
        createdAt: event.createdAt,
        updatedAt: event.updatedAt,
      },
    ],
    event.title,
  );

  return new NextResponse(calendar, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${event.slug}.ics"`,
      'Cache-Control': 'no-store',
    },
  });
}
