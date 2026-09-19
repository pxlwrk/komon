import Link from 'next/link';

import {
  Badge,
  Card,
  EmptyState,
  LinkButton,
  PageHeader,
  StatTile,
  Table,
  Td,
  Th,
  statusTone,
} from '@/components/ui';
import { EMAIL_KIND, EMAIL_STATUS, label } from '@/lib/enums';
import { formatDateTime } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';

import { QueueButton } from './queue-button';
import { processQueueAction } from './actions';

export const metadata = { title: 'Nachrichten' };

export default async function MessagesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ art?: string }>;
}) {
  const { slug } = await params;
  const context = await requirePermission(slug, 'mail.view');
  const query = await searchParams;

  const where = {
    communityId: context.community.id,
    ...(query.art === 'liste'
      ? { kind: 'LIST_DISTRIBUTION' }
      : query.art === 'system'
        ? { kind: 'TRANSACTIONAL' }
        : query.art === 'rund'
          ? { kind: 'CAMPAIGN' }
          : {}),
  };

  const [messages, pendingCount, sentCount, failedCount] = await Promise.all([
    prisma.emailMessage.findMany({
      where,
      include: {
        author: { select: { firstName: true, lastName: true } },
        _count: { select: { deliveries: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 60,
    }),
    prisma.emailDelivery.count({
      where: { status: 'QUEUED', message: { communityId: context.community.id } },
    }),
    prisma.emailDelivery.count({
      where: { status: 'SENT', message: { communityId: context.community.id } },
    }),
    prisma.emailDelivery.count({
      where: { status: { in: ['FAILED', 'BOUNCED'] }, message: { communityId: context.community.id } },
    }),
  ]);

  const filters = [
    { key: '', title: 'Alle' },
    { key: 'rund', title: 'Rundschreiben' },
    { key: 'liste', title: 'Listenverteilung' },
    { key: 'system', title: 'Systemnachrichten' },
  ];

  return (
    <>
      <PageHeader
        title="Nachrichten"
        description="Rundschreiben, Systemnachrichten und die Verteilung der Mailinglisten an einem Ort."
        actions={
          <>
            {context.can('mail.template.manage') ? (
              <LinkButton href={`/c/${slug}/nachrichten/vorlagen`} variant="secondary">
                Vorlagen
              </LinkButton>
            ) : null}
            {context.can('mail.compose') ? (
              <LinkButton href={`/c/${slug}/nachrichten/neu`}>Nachricht verfassen</LinkButton>
            ) : null}
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatTile label="Wartet auf Versand" value={pendingCount} />
        <StatTile label="Zugestellt" value={sentCount} />
        <StatTile label="Fehlgeschlagen" value={failedCount} />
      </div>

      {pendingCount > 0 && context.can('mail.send') ? (
        <div className="mb-4">
          <QueueButton action={processQueueAction.bind(null, slug)} pending={pendingCount} />
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-2">
        {filters.map((filter) => {
          const active = (query.art ?? '') === filter.key;
          return (
            <Link
              key={filter.key || 'alle'}
              href={filter.key ? `/c/${slug}/nachrichten?art=${filter.key}` : `/c/${slug}/nachrichten`}
              className={
                active
                  ? 'rounded-full bg-brand-600 px-3 py-1 text-sm font-medium text-white'
                  : 'rounded-full border border-slate-300 bg-white px-3 py-1 text-sm text-slate-600 hover:bg-slate-50'
              }
            >
              {filter.title}
            </Link>
          );
        })}
      </div>

      <Card>
        {messages.length === 0 ? (
          <EmptyState
            title="Noch keine Nachrichten"
            description="Sobald Sie ein Rundschreiben verfassen, erscheint es hier."
            action={
              context.can('mail.compose') ? (
                <LinkButton href={`/c/${slug}/nachrichten/neu`}>Nachricht verfassen</LinkButton>
              ) : null
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Betreff</Th>
                <Th className="hidden md:table-cell">Art</Th>
                <Th className="hidden lg:table-cell">Empfänger</Th>
                <Th className="hidden xl:table-cell">Zeitpunkt</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {messages.map((message) => (
                <tr key={message.id} className="transition hover:bg-slate-50">
                  <Td>
                    <Link href={`/c/${slug}/nachrichten/${message.id}`} className="block min-w-0">
                      <span className="block truncate font-medium text-slate-900">{message.subject}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {message.author
                          ? `${message.author.firstName} ${message.author.lastName}`
                          : 'Automatisch erstellt'}
                      </span>
                    </Link>
                  </Td>
                  <Td className="hidden md:table-cell text-xs text-slate-600">
                    {label(EMAIL_KIND, message.kind)}
                  </Td>
                  <Td className="hidden lg:table-cell tabular-nums text-sm">
                    {message.sentCount > 0
                      ? `${message.sentCount} von ${message._count.deliveries}`
                      : message._count.deliveries}
                  </Td>
                  <Td className="hidden xl:table-cell text-xs text-slate-500">
                    {formatDateTime(message.sentAt ?? message.scheduledAt ?? message.createdAt)}
                  </Td>
                  <Td>
                    <Badge tone={statusTone(message.status)}>{label(EMAIL_STATUS, message.status)}</Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
