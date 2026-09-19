import Link from 'next/link';
import { notFound } from 'next/navigation';

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
  ARCHIVE_POLICY,
  LIST_TYPE,
  MODERATION_POLICY,
  POSTING_POLICY,
  REPLY_TO_MODE,
  SUBSCRIPTION_POLICY,
  SUBSCRIPTION_ROLE,
  SUBSCRIPTION_STATUS,
  label,
} from '@/lib/enums';
import { formatDateTime } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';

import {
  addSubscribersAction,
  deleteListAction,
  postToListAction,
  removeSubscriberAction,
  syncListAction,
  updateListAction,
  updateSubscriptionAction,
} from '../actions';
import { ListForm } from '../list-forms';
import { DangerZone, PostForm, SubscriberPanel, SyncButton } from './list-detail-ui';

export default async function ListDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const context = await requirePermission(slug, 'list.view');

  const list = await prisma.mailingList.findFirst({
    where: { id, communityId: context.community.id },
    include: {
      community: { select: { mailDomain: true } },
      autoSubscribeGroup: { select: { id: true, name: true } },
      subscriptions: {
        include: {
          person: {
            select: { id: true, firstName: true, lastName: true, displayName: true, primaryEmail: true },
          },
        },
        orderBy: [{ role: 'asc' }, { person: { lastName: 'asc' } }],
      },
      _count: { select: { messages: true } },
    },
  });

  if (!list) notFound();

  const canManage = context.can('list.manage');
  const canModerate = context.can('list.moderate');

  const [pendingCount, recentMessages, groups, candidates] = await Promise.all([
    prisma.listMessage.count({ where: { listId: list.id, status: 'PENDING' } }),
    prisma.listMessage.findMany({
      where: { listId: list.id, status: { in: ['DISTRIBUTED', 'APPROVED'] } },
      orderBy: { receivedAt: 'desc' },
      take: 8,
      select: { id: true, subject: true, fromName: true, fromAddress: true, receivedAt: true },
    }),
    canManage
      ? prisma.group.findMany({
          where: { communityId: context.community.id },
          orderBy: { name: 'asc' },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    canManage
      ? prisma.membership.findMany({
          where: { communityId: context.community.id, status: { in: ['ACTIVE', 'PENDING', 'PAUSED'] } },
          include: {
            person: {
              select: { id: true, firstName: true, lastName: true, displayName: true, primaryEmail: true },
            },
          },
          orderBy: [{ person: { lastName: 'asc' } }],
        })
      : Promise.resolve([]),
  ]);

  const activeCount = list.subscriptions.filter((entry) => entry.status === 'ACTIVE').length;
  const subscribedIds = new Set(
    list.subscriptions.filter((entry) => entry.status === 'ACTIVE').map((entry) => entry.personId),
  );

  return (
    <>
      <PageHeader
        title={list.name}
        description={list.description ?? list.address}
        breadcrumb={
          <Link href={`/c/${slug}/listen`} className="hover:text-slate-700">
            Mailinglisten
          </Link>
        }
        actions={
          <>
            <LinkButton href={`/c/${slug}/listen/${list.id}/archiv`} variant="secondary">
              Archiv
            </LinkButton>
            {canModerate ? (
              <LinkButton
                href={`/c/${slug}/listen/${list.id}/moderation`}
                variant={pendingCount > 0 ? 'primary' : 'secondary'}
              >
                Moderation{pendingCount > 0 ? ` (${pendingCount})` : ''}
              </LinkButton>
            ) : null}
          </>
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <Badge tone="brand">{list.address}</Badge>
        {!list.isActive ? <Badge tone="danger">Stillgelegt</Badge> : null}
        <Badge>{label(LIST_TYPE, list.listType)}</Badge>
        <Badge tone="info">{label(POSTING_POLICY, list.postingPolicy)}</Badge>
        <Badge>{label(MODERATION_POLICY, list.moderationPolicy)}</Badge>
        <Badge>{label(SUBSCRIPTION_POLICY, list.subscriptionPolicy)}</Badge>
        <Badge>{label(REPLY_TO_MODE, list.replyToMode)}</Badge>
        <Badge>Archiv: {label(ARCHIVE_POLICY, list.archivePolicy)}</Badge>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatTile label="Aktive Eintragungen" value={activeCount} />
        <StatTile label="Beiträge insgesamt" value={list._count.messages} />
        <StatTile label="Wartet auf Freigabe" value={pendingCount} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title="Beitrag schreiben"
              description={`Die Nachricht geht an ${list.address} und durchläuft dieselben Regeln wie eine eingehende E-Mail.`}
            />
            <CardBody>
              <PostForm action={postToListAction.bind(null, slug, list.id)} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Zuletzt verteilt"
              action={
                <Link
                  href={`/c/${slug}/listen/${list.id}/archiv`}
                  className="text-sm text-brand-700 hover:underline"
                >
                  Zum Archiv
                </Link>
              }
            />
            <CardBody className={recentMessages.length === 0 ? 'p-0' : undefined}>
              {recentMessages.length === 0 ? (
                <EmptyState title="Noch keine Beiträge" />
              ) : (
                <ul className="space-y-2">
                  {recentMessages.map((message) => (
                    <li key={message.id}>
                      <Link
                        href={`/c/${slug}/listen/${list.id}/archiv/${message.id}`}
                        className="block rounded-lg px-2 py-1.5 transition hover:bg-slate-50"
                      >
                        <span className="block truncate text-sm font-medium text-slate-800">
                          {message.subject}
                        </span>
                        <span className="block truncate text-xs text-slate-500">
                          {message.fromName ?? message.fromAddress} · {formatDateTime(message.receivedAt)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          {canManage ? (
            <Card>
              <CardHeader title="Einstellungen" />
              <CardBody>
                <ListForm
                  action={updateListAction.bind(null, slug, list.id)}
                  groups={groups}
                  mailDomain={list.community.mailDomain ?? list.address.split('@')[1]}
                  idPrefix={`list-${list.id}`}
                  submitLabel="Einstellungen speichern"
                  values={{
                    name: list.name,
                    localPart: list.localPart,
                    description: list.description,
                    listType: list.listType,
                    postingPolicy: list.postingPolicy,
                    moderationPolicy: list.moderationPolicy,
                    subscriptionPolicy: list.subscriptionPolicy,
                    replyToMode: list.replyToMode,
                    archivePolicy: list.archivePolicy,
                    subjectPrefix: list.subjectPrefix,
                    footerText: list.footerText,
                    autoSubscribeGroupId: list.autoSubscribeGroupId,
                    isActive: list.isActive,
                  }}
                />
              </CardBody>
            </Card>
          ) : null}

          {canManage ? (
            <DangerZone action={deleteListAction.bind(null, slug, list.id)} name={list.name} />
          ) : null}
        </div>

        <div className="space-y-6">
          {list.autoSubscribeGroup && canManage ? (
            <Card>
              <CardHeader
                title="Abgleich mit Gruppe"
                description={`Eingetragen werden alle Mitglieder der Gruppe "${list.autoSubscribeGroup.name}".`}
              />
              <CardBody>
                <SyncButton action={syncListAction.bind(null, slug, list.id)} />
              </CardBody>
            </Card>
          ) : null}

          <SubscriberPanel
            canManage={canManage}
            detailBase={`/c/${slug}/teilnehmende`}
            subscriptions={list.subscriptions.map((subscription) => ({
              id: subscription.id,
              personId: subscription.personId,
              name:
                subscription.person.displayName ||
                `${subscription.person.firstName} ${subscription.person.lastName}`.trim(),
              email: subscription.person.primaryEmail,
              role: subscription.role,
              roleLabel: label(SUBSCRIPTION_ROLE, subscription.role),
              deliveryMode: subscription.deliveryMode,
              status: subscription.status,
              statusLabel: label(SUBSCRIPTION_STATUS, subscription.status),
              statusTone: statusTone(subscription.status),
              moderated: subscription.moderated,
              updateAction: updateSubscriptionAction.bind(null, slug, list.id, subscription.id),
              removeAction: removeSubscriberAction.bind(null, slug, list.id, subscription.personId),
            }))}
            candidates={candidates
              .filter((membership) => !subscribedIds.has(membership.person.id))
              .map((membership) => ({
                personId: membership.person.id,
                name:
                  membership.person.displayName ||
                  `${membership.person.lastName}, ${membership.person.firstName}`.replace(/^, /, ''),
                email: membership.person.primaryEmail,
              }))}
            addAction={addSubscribersAction.bind(null, slug, list.id)}
          />
        </div>
      </div>
    </>
  );
}
