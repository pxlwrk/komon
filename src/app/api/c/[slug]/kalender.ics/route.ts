import { NextResponse } from 'next/server';

import { collectCalendarItems } from '@/lib/calendar';
import { buildCalendar } from '@/lib/ics';
import { requirePermission } from '@/lib/rbac';

/** Stellt den gesamten Kalender einer Community als iCalendar-Datei bereit. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const context = await requirePermission(slug, 'calendar.view');

  const now = new Date();
  const from = new Date(now.getFullYear() - 1, now.getMonth(), 1);
  const to = new Date(now.getFullYear() + 2, now.getMonth(), 1);

  const items = await collectCalendarItems({
    communityId: context.community.id,
    slug,
    from,
    to,
    includeStaff: context.canAny('calendar.manage', 'community.manage'),
    personId: context.user.id,
    includeJournal: context.can('journal.view'),
  });

  const calendar = buildCalendar(
    items.map((item) => ({
      uid: `${item.id}@komon`,
      title: item.title,
      description: item.description,
      location: item.location,
      start: item.start,
      end: item.end,
      allDay: item.allDay,
      status: item.status === 'CANCELLED' ? 'CANCELLED' : 'CONFIRMED',
      recurrence: item.recurrence,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
    `${context.community.name} · Kalender`,
  );

  return new NextResponse(calendar, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${slug}-kalender.ics"`,
      'Cache-Control': 'no-store',
    },
  });
}
