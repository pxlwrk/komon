import { Card, CardBody, CardHeader, EmptyState, PageHeader } from '@/components/ui';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';

import {
  createGroupAction,
  deleteGroupAction,
  setGroupMembersAction,
  updateGroupAction,
} from './actions';
import { CreateGroupForm, GroupCard } from './group-ui';

export const metadata = { title: 'Gruppen' };

export default async function GroupsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const context = await requirePermission(slug, 'group.view');
  const canManage = context.can('group.manage');

  const [groups, memberships] = await Promise.all([
    prisma.group.findMany({
      where: { communityId: context.community.id },
      orderBy: { name: 'asc' },
      include: {
        members: { select: { membershipId: true } },
        mailingLists: { select: { id: true, name: true } },
      },
    }),
    canManage
      ? prisma.membership.findMany({
          where: { communityId: context.community.id, status: { in: ['ACTIVE', 'PENDING', 'PAUSED'] } },
          include: { person: { select: { firstName: true, lastName: true, primaryEmail: true, displayName: true } } },
          orderBy: [{ person: { lastName: 'asc' } }, { person: { firstName: 'asc' } }],
        })
      : Promise.resolve([]),
  ]);

  const candidates = memberships.map((membership) => ({
    id: membership.id,
    name:
      membership.person.displayName ||
      `${membership.person.lastName}, ${membership.person.firstName}`.replace(/^, /, ''),
    email: membership.person.primaryEmail,
  }));

  return (
    <>
      <PageHeader
        title="Gruppen"
        description="Gruppen bündeln Teilnehmende für Verteiler, Einladungen und Zugriffsrechte."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {groups.length === 0 ? (
            <Card>
              <EmptyState
                title="Noch keine Gruppen"
                description="Legen Sie eine Gruppe an, etwa für den Vorstand oder einen Arbeitskreis."
              />
            </Card>
          ) : (
            groups.map((group) => (
              <GroupCard
                key={group.id}
                group={{
                  id: group.id,
                  name: group.name,
                  description: group.description,
                  color: group.color,
                  memberCount: group.members.length,
                  memberIds: group.members.map((entry) => entry.membershipId),
                  lists: group.mailingLists.map((list) => list.name),
                }}
                candidates={candidates}
                canManage={canManage}
                updateAction={updateGroupAction.bind(null, slug, group.id)}
                membersAction={setGroupMembersAction.bind(null, slug, group.id)}
                deleteAction={deleteGroupAction.bind(null, slug, group.id)}
              />
            ))
          )}
        </div>

        {canManage ? (
          <Card className="h-fit">
            <CardHeader title="Neue Gruppe" />
            <CardBody>
              <CreateGroupForm action={createGroupAction.bind(null, slug)} />
            </CardBody>
          </Card>
        ) : null}
      </div>
    </>
  );
}
