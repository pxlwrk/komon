import Link from 'next/link';
import type { Prisma } from '@prisma/client';

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
  JOURNAL_CHANNEL,
  JOURNAL_STATUS,
  JOURNAL_TYPE,
  journalStatusValues,
  journalTypeValues,
  label,
} from '@/lib/enums';
import { formatDate, formatDateTime } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';

export const metadata = { title: 'Content-Journal' };

export default async function JournalPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string; art?: string; q?: string; ansicht?: string }>;
}) {
  const { slug } = await params;
  const context = await requirePermission(slug, 'journal.view');
  const query = await searchParams;
  const search = (query.q ?? '').trim();
  const view = query.ansicht === 'plan' ? 'plan' : 'liste';

  const where: Prisma.JournalEntryWhereInput = {
    communityId: context.community.id,
    ...(query.status && journalStatusValues.includes(query.status as never)
      ? { status: query.status }
      : {}),
    ...(query.art && journalTypeValues.includes(query.art as never) ? { type: query.art } : {}),
    ...(search
      ? { OR: [{ title: { contains: search } }, { summary: { contains: search } }, { content: { contains: search } }] }
      : {}),
    ...(context.can('journal.publish') ? {} : { OR: [{ visibility: { not: 'STAFF' } }, { authorId: context.user.id }] }),
  };

  const [entries, statusCounts, planned] = await Promise.all([
    prisma.journalEntry.findMany({
      where,
      orderBy: view === 'plan' ? [{ plannedAt: 'asc' }] : [{ updatedAt: 'desc' }],
      include: {
        author: { select: { firstName: true, lastName: true, displayName: true } },
        event: { select: { id: true, title: true } },
        tags: { include: { tag: { select: { id: true, name: true } } } },
        _count: { select: { comments: true } },
      },
      take: 100,
    }),
    prisma.journalEntry.groupBy({
      by: ['status'],
      where: { communityId: context.community.id },
      _count: { _all: true },
    }),
    prisma.journalEntry.count({
      where: {
        communityId: context.community.id,
        status: { in: ['SCHEDULED', 'IN_REVIEW'] },
        plannedAt: { gte: new Date() },
      },
    }),
  ]);

  const counts = Object.fromEntries(statusCounts.map((entry) => [entry.status, entry._count._all]));

  return (
    <>
      <PageHeader
        title="Content-Journal"
        description="Beschlüsse, Protokolle und geplante Beiträge, vom ersten Gedanken bis zur Veröffentlichung."
        actions={
          context.can('journal.write') ? (
            <LinkButton href={`/c/${slug}/journal/neu`}>Eintrag anlegen</LinkButton>
          ) : null
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <StatTile label="Entwürfe" value={counts.DRAFT ?? 0} />
        <StatTile label="In Abstimmung" value={counts.IN_REVIEW ?? 0} />
        <StatTile label="Geplant" value={planned} />
        <StatTile label="Veröffentlicht" value={counts.PUBLISHED ?? 0} />
      </div>

      <Card className="mb-4 p-4">
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <label htmlFor="q" className="sr-only">
              Suche
            </label>
            <input id="q" name="q" type="search" defaultValue={search} placeholder="Im Journal suchen" />
          </div>

          <div>
            <label htmlFor="status" className="sr-only">
              Status
            </label>
            <select id="status" name="status" defaultValue={query.status ?? ''}>
              <option value="">Alle Status</option>
              {journalStatusValues.map((value) => (
                <option key={value} value={value}>
                  {JOURNAL_STATUS[value]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="art" className="sr-only">
              Art
            </label>
            <select id="art" name="art" defaultValue={query.art ?? ''}>
              <option value="">Alle Arten</option>
              {journalTypeValues.map((value) => (
                <option key={value} value={value}>
                  {JOURNAL_TYPE[value]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <select name="ansicht" defaultValue={view} aria-label="Ansicht" className="min-w-0 flex-1">
              <option value="liste">Zuletzt bearbeitet</option>
              <option value="plan">Redaktionsplan</option>
            </select>
            <button
              type="submit"
              className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Filtern
            </button>
          </div>
        </form>
      </Card>

      {entries.length === 0 ? (
        <Card>
          <EmptyState
            title="Noch keine Einträge"
            description="Halten Sie hier Protokolle, Beschlüsse und geplante Beiträge fest."
            action={
              context.can('journal.write') ? (
                <LinkButton href={`/c/${slug}/journal/neu`}>Eintrag anlegen</LinkButton>
              ) : null
            }
          />
        </Card>
      ) : view === 'plan' ? (
        <PlanView slug={slug} entries={entries} />
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <Card key={entry.id}>
              <CardBody>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/c/${slug}/journal/${entry.id}`}
                      className="text-base font-semibold text-slate-900 hover:text-brand-700"
                    >
                      {entry.title}
                    </Link>
                    {entry.summary ? (
                      <p className="mt-1 line-clamp-2 text-sm text-slate-600">{entry.summary}</p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge tone={statusTone(entry.status)}>{label(JOURNAL_STATUS, entry.status)}</Badge>
                      <Badge>{label(JOURNAL_TYPE, entry.type)}</Badge>
                      <Badge tone="info">{label(JOURNAL_CHANNEL, entry.channel)}</Badge>
                      {entry.event ? <Badge tone="brand">{entry.event.title}</Badge> : null}
                      {entry.tags.map((link) => (
                        <Badge key={link.tag.id}>{link.tag.name}</Badge>
                      ))}
                      {entry._count.comments > 0 ? (
                        <Badge>{entry._count.comments} Kommentare</Badge>
                      ) : null}
                    </div>
                  </div>

                  <div className="shrink-0 text-right text-xs text-slate-500">
                    <p>
                      {entry.author
                        ? entry.author.displayName ||
                          `${entry.author.firstName} ${entry.author.lastName}`.trim()
                        : 'Ohne Verfasser'}
                    </p>
                    <p>{formatDateTime(entry.updatedAt)}</p>
                    {entry.plannedAt ? <p>Geplant: {formatDate(entry.plannedAt)}</p> : null}
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

type EntryWithRelations = Awaited<ReturnType<typeof prisma.journalEntry.findMany<{
  include: {
    author: { select: { firstName: true; lastName: true; displayName: true } };
    event: { select: { id: true; title: true } };
    tags: { include: { tag: { select: { id: true; name: true } } } };
    _count: { select: { comments: true } };
  };
}>>>;

function PlanView({ slug, entries }: { slug: string; entries: EntryWithRelations }) {
  const withDate = entries.filter((entry) => entry.plannedAt !== null);
  const withoutDate = entries.filter((entry) => entry.plannedAt === null);

  const groups = new Map<string, EntryWithRelations>();
  for (const entry of withDate) {
    const date = entry.plannedAt as Date;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(entry);
    } else {
      groups.set(key, [entry]);
    }
  }

  const monthNames = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
  ];

  return (
    <div className="space-y-4">
      {Array.from(groups.entries()).map(([key, monthEntries]) => {
        const [year, month] = key.split('-');
        return (
          <Card key={key}>
            <CardHeader title={`${monthNames[Number(month) - 1]} ${year}`} />
            <CardBody>
              <ul className="divide-y divide-slate-100">
                {monthEntries.map((entry) => (
                  <li key={entry.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0">
                    <div className="flex min-w-0 gap-3">
                      <span className="w-16 shrink-0 text-sm tabular-nums text-slate-500">
                        {entry.plannedAt ? formatDate(entry.plannedAt) : ''}
                      </span>
                      <div className="min-w-0">
                        <Link
                          href={`/c/${slug}/journal/${entry.id}`}
                          className="text-sm font-medium text-slate-800 hover:text-brand-700"
                        >
                          {entry.title}
                        </Link>
                        <p className="text-xs text-slate-500">
                          {label(JOURNAL_CHANNEL, entry.channel)} · {label(JOURNAL_TYPE, entry.type)}
                        </p>
                      </div>
                    </div>
                    <Badge tone={statusTone(entry.status)}>{label(JOURNAL_STATUS, entry.status)}</Badge>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        );
      })}

      {withoutDate.length > 0 ? (
        <Card>
          <CardHeader title="Ohne Termin" description="Ideen und Entwürfe, für die noch kein Datum feststeht." />
          <CardBody>
            <ul className="divide-y divide-slate-100">
              {withoutDate.map((entry) => (
                <li key={entry.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0">
                  <Link
                    href={`/c/${slug}/journal/${entry.id}`}
                    className="min-w-0 text-sm font-medium text-slate-800 hover:text-brand-700"
                  >
                    {entry.title}
                  </Link>
                  <Badge tone={statusTone(entry.status)}>{label(JOURNAL_STATUS, entry.status)}</Badge>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
