import Link from 'next/link';

import { Alert, Badge, Card, CardBody, CardHeader, EmptyState, PageHeader } from '@/components/ui';
import { ARCHIVE_POLICY, LIST_TYPE, POSTING_POLICY, label } from '@/lib/enums';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';

import { createListAction } from './actions';
import { CreateListForm } from './list-forms';

export const metadata = { title: 'Mailinglisten' };

export default async function ListsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const context = await requirePermission(slug, 'list.view');
  const canManage = context.can('list.manage');

  const [lists, groups, community] = await Promise.all([
    prisma.mailingList.findMany({
      where: { communityId: context.community.id },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { subscriptions: true, messages: true } },
        autoSubscribeGroup: { select: { name: true } },
      },
    }),
    prisma.group.findMany({
      where: { communityId: context.community.id },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.community.findUniqueOrThrow({
      where: { id: context.community.id },
      select: { mailDomain: true },
    }),
  ]);

  const pending = await prisma.listMessage.groupBy({
    by: ['listId'],
    where: { status: 'PENDING', list: { communityId: context.community.id } },
    _count: { _all: true },
  });
  const pendingByList = new Map(pending.map((entry) => [entry.listId, entry._count._all]));

  return (
    <>
      <PageHeader
        title="Mailinglisten"
        description="Gruppenmailadressen verteilen eingehende Nachrichten an alle eingetragenen Adressen, mit Moderation und Archiv."
      />

      {!community.mailDomain ? (
        <div className="mb-6">
          <Alert tone="warning" title="Domain fehlt">
            Für Gruppenmailadressen braucht diese Community eine eigene Domain.{' '}
            {context.can('community.manage') ? (
              <Link href={`/c/${slug}/einstellungen`} className="font-medium underline">
                Jetzt in den Einstellungen hinterlegen
              </Link>
            ) : (
              'Bitte wenden Sie sich an die Verwaltung.'
            )}
          </Alert>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {lists.length === 0 ? (
            <Card>
              <EmptyState
                title="Noch keine Liste"
                description="Eine Gruppenmailadresse bündelt den Austausch eines Kreises unter einer gemeinsamen Adresse."
              />
            </Card>
          ) : (
            lists.map((list) => {
              const waiting = pendingByList.get(list.id) ?? 0;
              return (
                <Card key={list.id}>
                  <CardHeader
                    title={
                      <Link href={`/c/${slug}/listen/${list.id}`} className="hover:text-brand-700">
                        {list.name}
                      </Link>
                    }
                    description={list.address}
                    action={
                      waiting > 0 && context.can('list.moderate') ? (
                        <Link href={`/c/${slug}/listen/${list.id}/moderation`}>
                          <Badge tone="warning">{waiting} zur Freigabe</Badge>
                        </Link>
                      ) : null
                    }
                  />
                  <CardBody className="space-y-3">
                    {list.description ? <p className="text-sm text-slate-600">{list.description}</p> : null}
                    <div className="flex flex-wrap gap-1.5">
                      {!list.isActive ? <Badge tone="danger">Stillgelegt</Badge> : null}
                      <Badge>{label(LIST_TYPE, list.listType)}</Badge>
                      <Badge tone="info">{label(POSTING_POLICY, list.postingPolicy)}</Badge>
                      <Badge>Archiv: {label(ARCHIVE_POLICY, list.archivePolicy)}</Badge>
                      {list.autoSubscribeGroup ? (
                        <Badge tone="brand">Gruppe: {list.autoSubscribeGroup.name}</Badge>
                      ) : null}
                    </div>
                    <p className="text-sm text-slate-500">
                      {list._count.subscriptions}{' '}
                      {list._count.subscriptions === 1 ? 'Eintrag' : 'Einträge'} ·{' '}
                      {list._count.messages} {list._count.messages === 1 ? 'Beitrag' : 'Beiträge'}
                    </p>
                  </CardBody>
                </Card>
              );
            })
          )}
        </div>

        {canManage && community.mailDomain ? (
          <Card className="h-fit">
            <CardHeader title="Neue Liste" description={`Adressen enden auf @${community.mailDomain}`} />
            <CardBody>
              <CreateListForm
                action={createListAction.bind(null, slug)}
                groups={groups}
                mailDomain={community.mailDomain}
              />
            </CardBody>
          </Card>
        ) : null}
      </div>
    </>
  );
}
