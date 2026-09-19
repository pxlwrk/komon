import Link from 'next/link';

import {
  Badge,
  Card,
  CardBody,
  EmptyState,
  LinkButton,
  PageHeader,
  StatTile,
  statusTone,
} from '@/components/ui';
import { EVENT_STATUS, label } from '@/lib/enums';
import { formatRange } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';

export const metadata = { title: 'Events' };

export default async function EventsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ zeitraum?: string; status?: string }>;
}) {
  const { slug } = await params;
  const context = await requirePermission(slug, 'event.view');
  const query = await searchParams;

  const scope = query.zeitraum === 'vergangen' ? 'past' : query.zeitraum === 'alle' ? 'all' : 'upcoming';
  const now = new Date();

  const events = await prisma.event.findMany({
    where: {
      communityId: context.community.id,
      ...(scope === 'upcoming' ? { endAt: { gte: now } } : {}),
      ...(scope === 'past' ? { endAt: { lt: now } } : {}),
      ...(query.status ? { status: query.status } : {}),
    },
    orderBy: { startAt: scope === 'past' ? 'desc' : 'asc' },
    include: {
      organizer: { select: { firstName: true, lastName: true, displayName: true } },
      _count: { select: { participations: true, tasks: true } },
    },
    take: 60,
  });

  const [upcomingCount, openTasks, pendingResponses] = await Promise.all([
    prisma.event.count({
      where: { communityId: context.community.id, endAt: { gte: now }, status: { notIn: ['CANCELLED', 'DRAFT'] } },
    }),
    prisma.eventTask.count({
      where: { event: { communityId: context.community.id }, status: { in: ['OPEN', 'IN_PROGRESS'] } },
    }),
    prisma.eventParticipation.count({
      where: { event: { communityId: context.community.id, endAt: { gte: now } }, status: 'INVITED' },
    }),
  ]);

  const scopes = [
    { key: '', title: 'Bevorstehend' },
    { key: 'vergangen', title: 'Vergangen' },
    { key: 'alle', title: 'Alle' },
  ];

  return (
    <>
      <PageHeader
        title="Events"
        description="Von der Planung über die Einladung bis zur Nachbereitung."
        actions={
          context.can('event.manage') ? (
            <LinkButton href={`/c/${slug}/events/neu`}>Event anlegen</LinkButton>
          ) : null
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatTile label="Bevorstehende Events" value={upcomingCount} />
        <StatTile label="Offene Aufgaben" value={openTasks} />
        <StatTile label="Ausstehende Rückmeldungen" value={pendingResponses} />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {scopes.map((entry) => {
          const active = (query.zeitraum ?? '') === entry.key;
          return (
            <Link
              key={entry.key || 'bevorstehend'}
              href={entry.key ? `/c/${slug}/events?zeitraum=${entry.key}` : `/c/${slug}/events`}
              className={
                active
                  ? 'rounded-full bg-brand-600 px-3 py-1 text-sm font-medium text-white'
                  : 'rounded-full border border-slate-300 bg-white px-3 py-1 text-sm text-slate-600 hover:bg-slate-50'
              }
            >
              {entry.title}
            </Link>
          );
        })}
      </div>

      {events.length === 0 ? (
        <Card>
          <EmptyState
            title={scope === 'past' ? 'Keine vergangenen Events' : 'Noch keine Events geplant'}
            description="Legen Sie ein Event an, um Einladungen und Rückmeldungen zu verwalten."
            action={
              context.can('event.manage') ? (
                <LinkButton href={`/c/${slug}/events/neu`}>Event anlegen</LinkButton>
              ) : null
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <Card key={event.id}>
              <CardBody>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/c/${slug}/events/${event.id}`}
                      className="text-base font-semibold text-slate-900 hover:text-brand-700"
                    >
                      {event.title}
                    </Link>
                    <p className="mt-0.5 text-sm text-slate-600">
                      {formatRange(event.startAt, event.endAt, event.allDay)}
                    </p>
                    {event.summary ? (
                      <p className="mt-1 line-clamp-2 text-sm text-slate-500">{event.summary}</p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge tone={statusTone(event.status)}>{label(EVENT_STATUS, event.status)}</Badge>
                      {event.locationName ? <Badge>{event.locationName}</Badge> : null}
                      {event.onlineUrl ? <Badge tone="info">Online</Badge> : null}
                      <Badge>
                        {event._count.participations}{' '}
                        {event._count.participations === 1 ? 'Eintrag' : 'Einträge'}
                      </Badge>
                      {event._count.tasks > 0 ? <Badge>{event._count.tasks} Aufgaben</Badge> : null}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    {event.organizer ? (
                      <p className="text-xs text-slate-500">
                        Verantwortung
                        <br />
                        {event.organizer.displayName ||
                          `${event.organizer.firstName} ${event.organizer.lastName}`.trim()}
                      </p>
                    ) : null}
                    {event.capacity ? (
                      <p className="mt-1 text-xs text-slate-500">Höchstzahl {event.capacity}</p>
                    ) : null}
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
