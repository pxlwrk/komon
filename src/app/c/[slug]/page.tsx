import Link from 'next/link';

import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  LinkButton,
  PageHeader,
  StatTile,
  statusTone,
} from '@/components/ui';
import {
  EVENT_STATUS,
  JOURNAL_STATUS,
  MEMBERSHIP_STATUS,
  label,
} from '@/lib/enums';
import { formatDateTime, formatRange, formatRelative } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { requireCommunity } from '@/lib/rbac';

export default async function CommunityDashboard({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const context = await requireCommunity(slug);
  const now = new Date();
  const communityId = context.community.id;

  const [
    memberCount,
    newMembers,
    upcomingEvents,
    openInvitations,
    pendingListMessages,
    queuedDeliveries,
    journalOpen,
    recentAudit,
    myTasks,
    plannedJournal,
  ] = await Promise.all([
    prisma.membership.count({ where: { communityId, status: 'ACTIVE' } }),
    prisma.membership.count({
      where: { communityId, joinedAt: { gte: new Date(Date.now() - 30 * 24 * 3600_000) } },
    }),
    prisma.event.findMany({
      where: { communityId, endAt: { gte: now }, status: { notIn: ['CANCELLED', 'DRAFT'] } },
      orderBy: { startAt: 'asc' },
      take: 5,
      include: { _count: { select: { participations: true } } },
    }),
    prisma.eventParticipation.count({
      where: { event: { communityId, endAt: { gte: now } }, status: 'INVITED' },
    }),
    context.can('list.moderate')
      ? prisma.listMessage.count({ where: { status: 'PENDING', list: { communityId } } })
      : Promise.resolve(0),
    context.can('mail.view')
      ? prisma.emailDelivery.count({ where: { status: 'QUEUED', message: { communityId } } })
      : Promise.resolve(0),
    context.can('journal.view')
      ? prisma.journalEntry.count({ where: { communityId, status: { in: ['DRAFT', 'IN_REVIEW'] } } })
      : Promise.resolve(0),
    context.can('audit.view')
      ? prisma.auditLog.findMany({
          where: { communityId },
          orderBy: { createdAt: 'desc' },
          take: 8,
          include: { actor: { select: { firstName: true, lastName: true, displayName: true } } },
        })
      : Promise.resolve([]),
    prisma.eventTask.findMany({
      where: {
        event: { communityId },
        assigneeId: context.user.id,
        status: { in: ['OPEN', 'IN_PROGRESS'] },
      },
      orderBy: [{ dueAt: 'asc' }],
      take: 6,
      include: { event: { select: { id: true, title: true } } },
    }),
    context.can('journal.view')
      ? prisma.journalEntry.findMany({
          where: {
            communityId,
            plannedAt: { gte: now },
            status: { in: ['IDEA', 'DRAFT', 'IN_REVIEW', 'SCHEDULED'] },
          },
          orderBy: { plannedAt: 'asc' },
          take: 5,
        })
      : Promise.resolve([]),
  ]);

  const openStatusCounts = await prisma.membership.groupBy({
    by: ['status'],
    where: { communityId },
    _count: { _all: true },
  });

  const todos = [
    pendingListMessages > 0
      ? {
          href: `/c/${slug}/listen`,
          title: `${pendingListMessages} Beiträge warten auf Freigabe`,
          tone: 'warning' as const,
        }
      : null,
    queuedDeliveries > 0
      ? {
          href: `/c/${slug}/nachrichten`,
          title: `${queuedDeliveries} Zustellungen in der Warteschlange`,
          tone: 'info' as const,
        }
      : null,
    openInvitations > 0
      ? {
          href: `/c/${slug}/events`,
          title: `${openInvitations} Rückmeldungen zu Events stehen aus`,
          tone: 'info' as const,
        }
      : null,
    journalOpen > 0
      ? {
          href: `/c/${slug}/journal`,
          title: `${journalOpen} Journaleinträge in Arbeit`,
          tone: 'neutral' as const,
        }
      : null,
  ].filter(Boolean) as { href: string; title: string; tone: 'warning' | 'info' | 'neutral' }[];

  return (
    <>
      <PageHeader
        title={context.community.name}
        description={context.community.description ?? 'Überblick über Ihre Community'}
        actions={
          <>
            {context.can('member.create') ? (
              <LinkButton href={`/c/${slug}/teilnehmende/neu`} variant="secondary">
                Person aufnehmen
              </LinkButton>
            ) : null}
            {context.can('event.manage') ? (
              <LinkButton href={`/c/${slug}/events/neu`}>Event anlegen</LinkButton>
            ) : null}
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Aktive Teilnehmende"
          value={memberCount}
          hint={newMembers > 0 ? `${newMembers} in den letzten 30 Tagen dazugekommen` : undefined}
          href={context.can('member.view') ? `/c/${slug}/teilnehmende` : undefined}
        />
        <StatTile
          label="Bevorstehende Events"
          value={upcomingEvents.length}
          href={context.can('event.view') ? `/c/${slug}/events` : undefined}
        />
        <StatTile
          label="Offene Rückmeldungen"
          value={openInvitations}
          href={context.can('event.view') ? `/c/${slug}/events` : undefined}
        />
        <StatTile
          label="Beiträge zur Freigabe"
          value={pendingListMessages}
          href={context.can('list.view') ? `/c/${slug}/listen` : undefined}
        />
      </div>

      {todos.length > 0 ? (
        <Card className="mb-6">
          <CardHeader title="Das wartet auf Sie" />
          <CardBody>
            <ul className="space-y-2">
              {todos.map((todo) => (
                <li key={todo.href}>
                  <Link
                    href={todo.href}
                    className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 transition hover:bg-slate-50"
                  >
                    <span className="text-sm text-slate-700">{todo.title}</span>
                    <Badge tone={todo.tone}>Ansehen</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title="Nächste Events"
              action={
                context.can('event.view') ? (
                  <Link href={`/c/${slug}/events`} className="text-sm text-brand-700 hover:underline">
                    Alle Events
                  </Link>
                ) : null
              }
            />
            <CardBody className={upcomingEvents.length === 0 ? 'p-0' : undefined}>
              {upcomingEvents.length === 0 ? (
                <EmptyState
                  title="Nichts geplant"
                  description="Sobald ein Event ansteht, erscheint es hier."
                  action={
                    context.can('event.manage') ? (
                      <LinkButton href={`/c/${slug}/events/neu`}>Event anlegen</LinkButton>
                    ) : null
                  }
                />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {upcomingEvents.map((event) => (
                    <li key={event.id} className="flex items-start justify-between gap-3 py-3 first:pt-0">
                      <div className="min-w-0">
                        <Link
                          href={`/c/${slug}/events/${event.id}`}
                          className="text-sm font-medium text-slate-800 hover:text-brand-700"
                        >
                          {event.title}
                        </Link>
                        <p className="text-xs text-slate-500">
                          {formatRange(event.startAt, event.endAt, event.allDay)}
                          {event.locationName ? ` · ${event.locationName}` : ''}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <Badge tone={statusTone(event.status)}>{label(EVENT_STATUS, event.status)}</Badge>
                        <p className="mt-1 text-xs text-slate-500">
                          {event._count.participations} auf der Liste
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          {myTasks.length > 0 ? (
            <Card>
              <CardHeader title="Ihre Aufgaben" description="Was zu Events ansteht, das Ihnen zugeordnet ist." />
              <CardBody>
                <ul className="divide-y divide-slate-100">
                  {myTasks.map((task) => (
                    <li key={task.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0">
                      <div className="min-w-0">
                        <Link
                          href={`/c/${slug}/events/${task.event.id}?bereich=aufgaben`}
                          className="text-sm font-medium text-slate-800 hover:text-brand-700"
                        >
                          {task.title}
                        </Link>
                        <p className="text-xs text-slate-500">{task.event.title}</p>
                      </div>
                      {task.dueAt ? (
                        <span className="shrink-0 text-xs text-slate-500">
                          {formatRelative(task.dueAt)}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}

          {context.can('audit.view') && recentAudit.length > 0 ? (
            <Card>
              <CardHeader
                title="Zuletzt geschehen"
                action={
                  <Link href={`/c/${slug}/protokoll`} className="text-sm text-brand-700 hover:underline">
                    Protokoll
                  </Link>
                }
              />
              <CardBody>
                <ul className="space-y-2">
                  {recentAudit.map((entry) => (
                    <li key={entry.id} className="flex items-start justify-between gap-3">
                      <span className="min-w-0 text-sm text-slate-700">{entry.summary}</span>
                      <span className="shrink-0 text-xs text-slate-500">
                        {formatRelative(entry.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Teilnehmende nach Status" />
            <CardBody>
              <ul className="space-y-2">
                {openStatusCounts
                  .sort((a, b) => b._count._all - a._count._all)
                  .map((entry) => (
                    <li key={entry.status} className="flex items-center justify-between gap-2">
                      <span className="text-sm text-slate-700">
                        {label(MEMBERSHIP_STATUS, entry.status)}
                      </span>
                      <span className="text-sm font-semibold tabular-nums text-slate-900">
                        {entry._count._all}
                      </span>
                    </li>
                  ))}
                {openStatusCounts.length === 0 ? (
                  <li className="text-sm text-slate-500">Noch niemand aufgenommen.</li>
                ) : null}
              </ul>
            </CardBody>
          </Card>

          {plannedJournal.length > 0 ? (
            <Card>
              <CardHeader
                title="Redaktionsplan"
                action={
                  <Link href={`/c/${slug}/journal`} className="text-sm text-brand-700 hover:underline">
                    Journal
                  </Link>
                }
              />
              <CardBody>
                <ul className="space-y-2">
                  {plannedJournal.map((entry) => (
                    <li key={entry.id}>
                      <Link
                        href={`/c/${slug}/journal/${entry.id}`}
                        className="block rounded-lg px-2 py-1.5 transition hover:bg-slate-50"
                      >
                        <span className="block truncate text-sm font-medium text-slate-800">
                          {entry.title}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {entry.plannedAt ? formatDateTime(entry.plannedAt) : ''} ·{' '}
                          {label(JOURNAL_STATUS, entry.status)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Ihre Rolle" />
            <CardBody className="space-y-2 text-sm text-slate-600">
              <p>{context.access.roleNames.join(', ') || 'Ohne Rolle'}</p>
              <p className="text-xs text-slate-500">
                {context.permissions.size}{' '}
                {context.permissions.size === 1 ? 'Berechtigung' : 'Berechtigungen'} in dieser
                Community.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
