import Link from 'next/link';

import { Badge, Card, CardBody, CardHeader, LinkButton, PageHeader } from '@/components/ui';
import { buildMonthGrid, collectCalendarItems, monthRange } from '@/lib/calendar';
import { CALENDAR_KIND, CALENDAR_VISIBILITY, calendarKindValues, calendarVisibilityValues, label } from '@/lib/enums';
import { formatRange, formatTime } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';

import { deleteCalendarEntryAction, saveCalendarEntryAction } from './actions';
import { CalendarEntryForm, EntryActions } from './calendar-ui';

export const metadata = { title: 'Kalender' };

const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export default async function CalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ monat?: string; jahr?: string }>;
}) {
  const { slug } = await params;
  const context = await requirePermission(slug, 'calendar.view');
  const query = await searchParams;

  const today = new Date();
  const year = Number.parseInt(query.jahr ?? '', 10) || today.getFullYear();
  const month = Number.isFinite(Number.parseInt(query.monat ?? '', 10))
    ? Math.min(11, Math.max(0, Number.parseInt(query.monat ?? '', 10) - 1))
    : today.getMonth();

  const { from, to } = monthRange(year, month);
  const grid = buildMonthGrid(year, month);
  const gridStart = grid[0];
  const gridEnd = new Date(grid[grid.length - 1].getTime() + 24 * 3600_000 - 1);

  const items = await collectCalendarItems({
    communityId: context.community.id,
    slug,
    from: gridStart,
    to: gridEnd,
    includeStaff: context.canAny('calendar.manage', 'community.manage'),
    personId: context.user.id,
    includeJournal: context.can('journal.view'),
  });

  const byDay = new Map<string, typeof items>();
  for (const item of items) {
    // Mehrtaegige Einträge erscheinen an jedem betroffenen Tag.
    const cursor = new Date(item.start.getFullYear(), item.start.getMonth(), item.start.getDate());
    const last = new Date(item.end.getFullYear(), item.end.getMonth(), item.end.getDate());
    while (cursor.getTime() <= last.getTime()) {
      const key = dayKey(cursor);
      const bucket = byDay.get(key);
      if (bucket) {
        bucket.push(item);
      } else {
        byDay.set(key, [item]);
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  const upcoming = items
    .filter((item) => item.end.getTime() >= Date.now())
    .slice(0, 12);

  const editable = context.can('calendar.manage')
    ? await prisma.calendarEntry.findMany({
        where: {
          communityId: context.community.id,
          eventId: null,
          startAt: { gte: from, lte: to },
        },
        orderBy: { startAt: 'asc' },
      })
    : [];

  const prev = month === 0 ? { jahr: year - 1, monat: 12 } : { jahr: year, monat: month };
  const next = month === 11 ? { jahr: year + 1, monat: 1 } : { jahr: year, monat: month + 2 };

  return (
    <>
      <PageHeader
        title="Kalender"
        description="Events, Termine und geplante Veröffentlichungen in einer Ansicht."
        actions={
          <>
            <LinkButton href={`/api/c/${slug}/kalender.ics`} variant="secondary" prefetch={false}>
              Kalender abonnieren
            </LinkButton>
            <LinkButton
              href={`/c/${slug}/kalender?jahr=${today.getFullYear()}&monat=${today.getMonth() + 1}`}
              variant="secondary"
            >
              Heute
            </LinkButton>
          </>
        }
      />

      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          href={`/c/${slug}/kalender?jahr=${prev.jahr}&monat=${prev.monat}`}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          Vorheriger Monat
        </Link>
        <h2 className="text-lg font-semibold text-slate-900">
          {MONTH_NAMES[month]} {year}
        </h2>
        <Link
          href={`/c/${slug}/kalender?jahr=${next.jahr}&monat=${next.monat}`}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          Nächster Monat
        </Link>
      </div>

      <Card className="mb-6 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
          {WEEKDAYS.map((day) => (
            <div key={day} className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {grid.map((day) => {
            const inMonth = day.getMonth() === month;
            const isToday = dayKey(day) === dayKey(today);
            const dayItems = byDay.get(dayKey(day)) ?? [];

            return (
              <div
                key={day.toISOString()}
                className={[
                  'min-h-[104px] border-b border-r border-slate-100 p-1.5',
                  inMonth ? 'bg-white' : 'bg-slate-50/60',
                ].join(' ')}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={[
                      'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs tabular-nums',
                      isToday ? 'bg-brand-600 font-semibold text-white' : inMonth ? 'text-slate-700' : 'text-slate-400',
                    ].join(' ')}
                  >
                    {day.getDate()}
                  </span>
                </div>

                <ul className="space-y-1">
                  {dayItems.slice(0, 3).map((item) => {
                    const content = (
                      <span className="block truncate">
                        {!item.allDay ? (
                          <span className="mr-1 tabular-nums opacity-70">{formatTime(item.start)}</span>
                        ) : null}
                        {item.title}
                      </span>
                    );
                    const className = [
                      'block rounded px-1 py-0.5 text-[11px] leading-tight',
                      item.kind === 'EVENT'
                        ? 'bg-brand-50 text-brand-800 hover:bg-brand-100'
                        : item.kind === 'JOURNAL'
                          ? 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
                    ].join(' ');

                    return (
                      <li key={`${item.id}-${dayKey(day)}`}>
                        {item.href ? (
                          <Link href={item.href} className={className} title={item.title}>
                            {content}
                          </Link>
                        ) : (
                          <span className={className} title={item.title}>
                            {content}
                          </span>
                        )}
                      </li>
                    );
                  })}
                  {dayItems.length > 3 ? (
                    <li className="px-1 text-[11px] text-slate-500">+{dayItems.length - 3} weitere</li>
                  ) : null}
                </ul>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Als Nächstes" description="Die kommenden Termine dieses Zeitraums" />
            <CardBody>
              {upcoming.length === 0 ? (
                <p className="text-sm text-slate-500">In diesem Monat steht nichts mehr an.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {upcoming.map((item) => (
                    <li key={item.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0">
                      <div className="min-w-0">
                        {item.href ? (
                          <Link href={item.href} className="text-sm font-medium text-slate-800 hover:text-brand-700">
                            {item.title}
                          </Link>
                        ) : (
                          <span className="text-sm font-medium text-slate-800">{item.title}</span>
                        )}
                        <p className="text-xs text-slate-500">
                          {formatRange(item.start, item.end, item.allDay)}
                          {item.location ? ` · ${item.location}` : ''}
                        </p>
                      </div>
                      <Badge
                        tone={item.kind === 'EVENT' ? 'brand' : item.kind === 'JOURNAL' ? 'warning' : 'neutral'}
                      >
                        {item.kind === 'EVENT'
                          ? 'Event'
                          : item.kind === 'JOURNAL'
                            ? 'Veröffentlichung'
                            : label(CALENDAR_KIND, item.category)}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          {context.can('calendar.manage') && editable.length > 0 ? (
            <Card>
              <CardHeader title="Termine dieses Monats bearbeiten" />
              <CardBody>
                <ul className="divide-y divide-slate-100">
                  {editable.map((entry) => (
                    <li key={entry.id} className="py-2.5 first:pt-0">
                      <EntryActions
                        entry={{
                          id: entry.id,
                          title: entry.title,
                          description: entry.description,
                          location: entry.location,
                          startAt: toLocalInput(entry.startAt),
                          endAt: toLocalInput(entry.endAt),
                          allDay: entry.allDay,
                          kind: entry.kind,
                          visibility: entry.visibility,
                          recurrence: entry.recurrence,
                          rangeLabel: formatRange(entry.startAt, entry.endAt, entry.allDay),
                          kindLabel: label(CALENDAR_KIND, entry.kind),
                          visibilityLabel: label(CALENDAR_VISIBILITY, entry.visibility),
                        }}
                        saveAction={saveCalendarEntryAction.bind(null, slug, entry.id)}
                        deleteAction={deleteCalendarEntryAction.bind(null, slug, entry.id)}
                        kinds={calendarKindValues.map((value) => ({ value, title: CALENDAR_KIND[value] }))}
                        visibilities={calendarVisibilityValues.map((value) => ({
                          value,
                          title: CALENDAR_VISIBILITY[value],
                        }))}
                      />
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}
        </div>

        {context.can('calendar.manage') ? (
          <Card className="h-fit">
            <CardHeader title="Neuer Termin" />
            <CardBody>
              <CalendarEntryForm
                action={saveCalendarEntryAction.bind(null, slug, null)}
                idPrefix="neu"
                submitLabel="Termin anlegen"
                kinds={calendarKindValues.map((value) => ({ value, title: CALENDAR_KIND[value] }))}
                visibilities={calendarVisibilityValues.map((value) => ({
                  value,
                  title: CALENDAR_VISIBILITY[value],
                }))}
              />
            </CardBody>
          </Card>
        ) : null}
      </div>
    </>
  );
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function toLocalInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
