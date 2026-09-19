import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Card, CardBody, CardHeader, EmptyState, PageHeader } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';

import { approveMessageAction, rejectMessageAction } from '../../actions';
import { ModerationItem } from './moderation-ui';

export const metadata = { title: 'Moderation' };

export default async function ModerationPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const context = await requirePermission(slug, 'list.moderate');

  const list = await prisma.mailingList.findFirst({
    where: { id, communityId: context.community.id },
    select: { id: true, name: true, address: true },
  });
  if (!list) notFound();

  const [pending, recentlyHandled] = await Promise.all([
    prisma.listMessage.findMany({
      where: { listId: list.id, status: 'PENDING' },
      orderBy: { receivedAt: 'asc' },
      include: { sender: { select: { firstName: true, lastName: true } } },
    }),
    prisma.listMessage.findMany({
      where: { listId: list.id, status: { in: ['REJECTED', 'DISTRIBUTED'] }, moderatedAt: { not: null } },
      orderBy: { moderatedAt: 'desc' },
      take: 10,
      include: { moderator: { select: { firstName: true, lastName: true } } },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Moderation"
        description={`Beiträge, die vor der Verteilung an ${list.address} geprüft werden.`}
        breadcrumb={
          <Link href={`/c/${slug}/listen/${list.id}`} className="hover:text-slate-700">
            {list.name}
          </Link>
        }
      />

      <div className="space-y-4">
        {pending.length === 0 ? (
          <Card>
            <EmptyState
              title="Nichts zu tun"
              description="Zurzeit wartet kein Beitrag auf eine Entscheidung."
            />
          </Card>
        ) : (
          pending.map((message) => (
            <ModerationItem
              key={message.id}
              message={{
                id: message.id,
                subject: message.subject,
                fromName: message.fromName,
                fromAddress: message.fromAddress,
                senderName: message.sender
                  ? `${message.sender.firstName} ${message.sender.lastName}`.trim()
                  : null,
                bodyText: message.bodyText,
                receivedAt: formatDateTime(message.receivedAt),
                reason: message.moderationReason,
                sizeBytes: message.sizeBytes,
              }}
              approveAction={approveMessageAction.bind(null, slug, list.id, message.id)}
              rejectAction={rejectMessageAction.bind(null, slug, list.id, message.id)}
            />
          ))
        )}
      </div>

      {recentlyHandled.length > 0 ? (
        <Card className="mt-8">
          <CardHeader title="Zuletzt entschieden" />
          <CardBody>
            <ul className="divide-y divide-slate-100">
              {recentlyHandled.map((message) => (
                <li key={message.id} className="flex items-start justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <Link
                      href={`/c/${slug}/listen/${list.id}/archiv/${message.id}`}
                      className="block truncate text-sm font-medium text-slate-800 hover:text-brand-700"
                    >
                      {message.subject}
                    </Link>
                    <p className="truncate text-xs text-slate-500">
                      {message.fromAddress} · {formatDateTime(message.moderatedAt)}
                      {message.moderator
                        ? ` durch ${message.moderator.firstName} ${message.moderator.lastName}`
                        : ''}
                    </p>
                    {message.moderationReason ? (
                      <p className="text-xs text-slate-500">Grund: {message.moderationReason}</p>
                    ) : null}
                  </div>
                  <span
                    className={
                      message.status === 'DISTRIBUTED'
                        ? 'shrink-0 text-xs font-medium text-emerald-700'
                        : 'shrink-0 text-xs font-medium text-red-700'
                    }
                  >
                    {message.status === 'DISTRIBUTED' ? 'Verteilt' : 'Abgelehnt'}
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}
    </>
  );
}
