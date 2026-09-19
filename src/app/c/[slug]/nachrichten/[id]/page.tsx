import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  PageHeader,
  StatTile,
  Table,
  Td,
  Th,
  statusTone,
} from '@/components/ui';
import { DELIVERY_STATUS, EMAIL_KIND, EMAIL_STATUS, label } from '@/lib/enums';
import { formatDateTime } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';

import { cancelMessageAction, retryFailedAction, sendDraftAction } from '../actions';
import { MessageActions } from './message-actions';

export default async function MessageDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const context = await requirePermission(slug, 'mail.view');

  const message = await prisma.emailMessage.findFirst({
    where: { id, communityId: context.community.id },
    include: {
      author: { select: { firstName: true, lastName: true } },
      sourceListMessage: { select: { id: true, listId: true, subject: true } },
      event: { select: { id: true, title: true } },
      deliveries: {
        orderBy: [{ status: 'asc' }, { toAddress: 'asc' }],
        take: 300,
      },
    },
  });

  if (!message) notFound();

  const counts = message.deliveries.reduce<Record<string, number>>((accumulator, delivery) => {
    accumulator[delivery.status] = (accumulator[delivery.status] ?? 0) + 1;
    return accumulator;
  }, {});

  const failed = (counts.FAILED ?? 0) + (counts.BOUNCED ?? 0);
  const canSend = context.can('mail.send');

  return (
    <>
      <PageHeader
        title={message.subject}
        description={
          message.author
            ? `Verfasst von ${message.author.firstName} ${message.author.lastName} am ${formatDateTime(message.createdAt)}`
            : `Automatisch erstellt am ${formatDateTime(message.createdAt)}`
        }
        breadcrumb={
          <Link href={`/c/${slug}/nachrichten`} className="hover:text-slate-700">
            Nachrichten
          </Link>
        }
        actions={
          canSend ? (
            <MessageActions
              status={message.status}
              failedCount={failed}
              sendAction={sendDraftAction.bind(null, slug, message.id)}
              cancelAction={cancelMessageAction.bind(null, slug, message.id)}
              retryAction={retryFailedAction.bind(null, slug, message.id)}
            />
          ) : null
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <Badge tone={statusTone(message.status)}>{label(EMAIL_STATUS, message.status)}</Badge>
        <Badge>{label(EMAIL_KIND, message.kind)}</Badge>
        {message.scheduledAt ? <Badge tone="warning">Geplant für {formatDateTime(message.scheduledAt)}</Badge> : null}
        {message.sentAt ? <Badge tone="success">Versendet am {formatDateTime(message.sentAt)}</Badge> : null}
        {message.event ? (
          <Link href={`/c/${slug}/events/${message.event.id}`}>
            <Badge tone="brand">Zum Event: {message.event.title}</Badge>
          </Link>
        ) : null}
        {message.sourceListMessage ? (
          <Link href={`/c/${slug}/listen/${message.sourceListMessage.listId}/archiv/${message.sourceListMessage.id}`}>
            <Badge tone="brand">Aus der Mailingliste</Badge>
          </Link>
        ) : null}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <StatTile label="Empfänger" value={message.recipientCount} />
        <StatTile label="Zugestellt" value={counts.SENT ?? 0} />
        <StatTile label="Offen" value={(counts.QUEUED ?? 0) + (counts.SENDING ?? 0)} />
        <StatTile label="Fehlgeschlagen" value={failed} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader title="Inhalt" description={`Von ${message.fromName ?? ''} <${message.fromEmail ?? ''}>`} />
            <CardBody>
              <p className="prose-note">{message.bodyText}</p>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader title="Zustellung" description={`Die ersten ${message.deliveries.length} Einträge`} />
          <CardBody className="p-0">
            <Table>
              <thead>
                <tr>
                  <Th>Adresse</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {message.deliveries.map((delivery) => (
                  <tr key={delivery.id}>
                    <Td>
                      <span className="block truncate text-sm">{delivery.toAddress}</span>
                      {delivery.lastError ? (
                        <span className="block truncate text-xs text-red-600" title={delivery.lastError}>
                          {delivery.lastError}
                        </span>
                      ) : delivery.sentAt ? (
                        <span className="block text-xs text-slate-500">{formatDateTime(delivery.sentAt)}</span>
                      ) : null}
                    </Td>
                    <Td>
                      <Badge tone={statusTone(delivery.status)}>
                        {label(DELIVERY_STATUS, delivery.status)}
                      </Badge>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
