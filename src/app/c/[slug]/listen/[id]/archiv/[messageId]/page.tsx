import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Alert, Badge, Card, CardBody, CardHeader, PageHeader, statusTone } from '@/components/ui';
import { ARCHIVE_POLICY, LIST_MESSAGE_STATUS, label } from '@/lib/enums';
import { formatBytes, formatDateTime } from '@/lib/format';
import { canViewArchive } from '@/lib/mailinglist';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';

export default async function ArchiveMessagePage({
  params,
}: {
  params: Promise<{ slug: string; id: string; messageId: string }>;
}) {
  const { slug, id, messageId } = await params;
  const context = await requirePermission(slug, 'list.archive.view');

  const message = await prisma.listMessage.findFirst({
    where: { id: messageId, list: { id, communityId: context.community.id } },
    include: {
      list: { select: { id: true, name: true, address: true, archivePolicy: true } },
      sender: { select: { firstName: true, lastName: true } },
      moderator: { select: { firstName: true, lastName: true } },
      attachments: true,
    },
  });

  if (!message) notFound();

  const subscription = await prisma.listSubscription.findUnique({
    where: { listId_personId: { listId: message.listId, personId: context.user.id } },
    select: { status: true },
  });

  const canModerate = context.canAny('list.moderate', 'list.manage');
  const allowed = canViewArchive({
    archivePolicy: message.list.archivePolicy,
    isCommunityMember: true,
    isSubscriber: subscription?.status === 'ACTIVE',
    canModerate,
  });

  if (!allowed) {
    return (
      <>
        <PageHeader title="Beitrag" description={message.list.name} />
        <Alert tone="info" title="Kein Zugriff">
          Das Archiv dieser Liste ist auf{' '}
          {label(ARCHIVE_POLICY, message.list.archivePolicy).toLowerCase()} beschränkt.
        </Alert>
      </>
    );
  }

  const thread = await prisma.listMessage.findMany({
    where: {
      listId: message.listId,
      status: { in: ['DISTRIBUTED', 'APPROVED'] },
      OR: [
        { threadId: message.threadId ?? message.messageIdHeader },
        { messageIdHeader: message.threadId ?? message.messageIdHeader },
      ],
    },
    orderBy: { receivedAt: 'asc' },
    select: { id: true, subject: true, fromName: true, fromAddress: true, receivedAt: true },
  });

  return (
    <>
      <PageHeader
        title={message.subject}
        description={`${message.fromName ?? message.fromAddress} · ${formatDateTime(message.receivedAt)}`}
        breadcrumb={
          <span className="flex flex-wrap items-center gap-1">
            <Link href={`/c/${slug}/listen/${message.listId}`} className="hover:text-slate-700">
              {message.list.name}
            </Link>
            <span>·</span>
            <Link href={`/c/${slug}/listen/${message.listId}/archiv`} className="hover:text-slate-700">
              Archiv
            </Link>
          </span>
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <Badge tone={statusTone(message.status)}>{label(LIST_MESSAGE_STATUS, message.status)}</Badge>
        {message.distributedAt ? (
          <Badge tone="success">An {message.recipientCount} Adressen verteilt</Badge>
        ) : null}
        <Badge>{formatBytes(message.sizeBytes)}</Badge>
        {message.moderator ? (
          <Badge tone="info">
            Geprüft durch {message.moderator.firstName} {message.moderator.lastName}
          </Badge>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              title={message.subject}
              description={`Von ${message.fromName ? `${message.fromName} <${message.fromAddress}>` : message.fromAddress}`}
            />
            <CardBody>
              <p className="prose-note">{message.bodyText}</p>

              {message.attachments.length > 0 ? (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <p className="mb-2 text-sm font-medium text-slate-700">Anhänge</p>
                  <ul className="space-y-1">
                    {message.attachments.map((attachment) => (
                      <li key={attachment.id} className="text-sm text-slate-600">
                        {attachment.fileName} · {formatBytes(attachment.sizeBytes)}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardBody>
          </Card>
        </div>

        {thread.length > 1 ? (
          <Card className="h-fit">
            <CardHeader title="Gesprächsverlauf" description={`${thread.length} Beiträge`} />
            <CardBody>
              <ol className="space-y-2">
                {thread.map((entry, index) => (
                  <li key={entry.id}>
                    <Link
                      href={`/c/${slug}/listen/${message.listId}/archiv/${entry.id}`}
                      className={
                        entry.id === message.id
                          ? 'block rounded-lg bg-brand-50 px-2 py-1.5'
                          : 'block rounded-lg px-2 py-1.5 hover:bg-slate-50'
                      }
                    >
                      <span className="block truncate text-sm text-slate-800">
                        {index + 1}. {entry.fromName ?? entry.fromAddress}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {formatDateTime(entry.receivedAt)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        ) : null}
      </div>
    </>
  );
}
