import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Alert, Badge, Card, CardBody, EmptyState, PageHeader } from '@/components/ui';
import { ARCHIVE_POLICY, label } from '@/lib/enums';
import { formatDateTime } from '@/lib/format';
import { canViewArchive } from '@/lib/mailinglist';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';

export const metadata = { title: 'Archiv' };

export default async function ArchivePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { slug, id } = await params;
  const context = await requirePermission(slug, 'list.archive.view');
  const query = await searchParams;
  const search = (query.q ?? '').trim();

  const list = await prisma.mailingList.findFirst({
    where: { id, communityId: context.community.id },
    select: { id: true, name: true, address: true, archivePolicy: true },
  });
  if (!list) notFound();

  const subscription = await prisma.listSubscription.findUnique({
    where: { listId_personId: { listId: list.id, personId: context.user.id } },
    select: { status: true },
  });

  const allowed = canViewArchive({
    archivePolicy: list.archivePolicy,
    isCommunityMember: true,
    isSubscriber: subscription?.status === 'ACTIVE',
    canModerate: context.canAny('list.moderate', 'list.manage'),
  });

  if (!allowed) {
    return (
      <>
        <PageHeader
          title="Archiv"
          description={list.name}
          breadcrumb={
            <Link href={`/c/${slug}/listen/${list.id}`} className="hover:text-slate-700">
              {list.name}
            </Link>
          }
        />
        <Alert tone="info" title="Kein Zugriff">
          Das Archiv dieser Liste ist auf {label(ARCHIVE_POLICY, list.archivePolicy).toLowerCase()}{' '}
          beschränkt. Tragen Sie sich in die Liste ein, um mitzulesen.
        </Alert>
      </>
    );
  }

  const messages = await prisma.listMessage.findMany({
    where: {
      listId: list.id,
      status: { in: ['DISTRIBUTED', 'APPROVED'] },
      ...(search
        ? {
            OR: [
              { subject: { contains: search } },
              { bodyText: { contains: search } },
              { fromAddress: { contains: search } },
            ],
          }
        : {}),
    },
    orderBy: { receivedAt: 'desc' },
    take: 200,
    select: {
      id: true,
      subject: true,
      fromName: true,
      fromAddress: true,
      receivedAt: true,
      threadId: true,
      messageIdHeader: true,
      recipientCount: true,
    },
  });

  // Nachrichten werden zu Gespraechen gebuendelt, die neueste zuerst.
  const threads = new Map<string, typeof messages>();
  for (const message of messages) {
    const key = message.threadId ?? message.messageIdHeader;
    const bucket = threads.get(key);
    if (bucket) {
      bucket.push(message);
    } else {
      threads.set(key, [message]);
    }
  }

  return (
    <>
      <PageHeader
        title="Archiv"
        description={`Alle verteilten Beiträge von ${list.address}`}
        breadcrumb={
          <Link href={`/c/${slug}/listen/${list.id}`} className="hover:text-slate-700">
            {list.name}
          </Link>
        }
      />

      <Card className="mb-4 p-4">
        <form className="flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Im Archiv suchen"
            className="min-w-0 flex-1"
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Suchen
          </button>
        </form>
      </Card>

      {threads.size === 0 ? (
        <Card>
          <EmptyState
            title={search ? 'Keine Treffer' : 'Noch keine Beiträge'}
            description={search ? 'Versuchen Sie einen anderen Suchbegriff.' : undefined}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {Array.from(threads.entries()).map(([key, entries]) => {
            const head = entries[0];
            return (
              <Card key={key}>
                <CardBody className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/c/${slug}/listen/${list.id}/archiv/${head.id}`}
                      className="min-w-0 text-base font-medium text-slate-900 hover:text-brand-700"
                    >
                      {head.subject}
                    </Link>
                    {entries.length > 1 ? (
                      <Badge tone="info">{entries.length} Beiträge</Badge>
                    ) : null}
                  </div>

                  <ul className="space-y-1">
                    {entries.map((entry) => (
                      <li key={entry.id} className="flex items-baseline justify-between gap-3 text-sm">
                        <Link
                          href={`/c/${slug}/listen/${list.id}/archiv/${entry.id}`}
                          className="min-w-0 truncate text-slate-600 hover:text-brand-700"
                        >
                          {entry.fromName ?? entry.fromAddress}
                        </Link>
                        <span className="shrink-0 text-xs text-slate-500">
                          {formatDateTime(entry.receivedAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
