import Link from 'next/link';

import { Avatar, Badge, Card, CardBody, CardHeader, EmptyState, PageHeader, StatTile } from '@/components/ui';
import { formatDate, formatDateTime, initials } from '@/lib/format';
import { PERMISSION_GROUPS, PERMISSIONS, parsePermissions } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { requireCommunity } from '@/lib/rbac';

import {
  deleteRoleAction,
  inviteAccountAction,
  resetPasswordAction,
  revokeAccessAction,
  revokeInvitationAction,
  saveRoleAction,
} from './actions';
import { AccountRow, InviteForm, RoleCard, RoleForm } from './access-ui';

export const metadata = { title: 'Benutzer und Rechte' };

export default async function AccessPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const context = await requireCommunity(slug);

  if (!context.canAny('role.view', 'account.manage')) {
    context.require('role.view');
  }

  const canManageRoles = context.can('role.manage');
  const canManageAccounts = context.can('account.manage');

  const [roles, accounts, invitations] = await Promise.all([
    prisma.role.findMany({
      where: { communityId: context.community.id },
      orderBy: [{ rank: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { memberships: true } } },
    }),
    prisma.membership.findMany({
      where: { communityId: context.community.id, person: { passwordHash: { not: null } } },
      include: {
        person: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            displayName: true,
            primaryEmail: true,
            lastLoginAt: true,
            isSuperAdmin: true,
            mustChangePassword: true,
            lockedUntil: true,
          },
        },
        roles: { include: { role: { select: { name: true } } } },
      },
      orderBy: [{ person: { lastName: 'asc' } }],
    }),
    canManageAccounts
      ? prisma.accountInvitation.findMany({
          where: { communityId: context.community.id, acceptedAt: null, revokedAt: null },
          orderBy: { createdAt: 'desc' },
          include: { role: { select: { name: true } } },
        })
      : Promise.resolve([]),
  ]);

  const memberCount = await prisma.membership.count({ where: { communityId: context.community.id } });

  const permissionGroups = PERMISSION_GROUPS.map((group) => ({
    title: group.title,
    permissions: group.permissions.map((permission) => ({
      key: permission,
      title: PERMISSIONS[permission],
      available: context.user.isSuperAdmin || context.permissions.has(permission),
    })),
  }));

  return (
    <>
      <PageHeader
        title="Benutzer und Rechte"
        description="Wer darf was? Rollen bündeln Berechtigungen, Konten geben Zugang zur Anwendung."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatTile label="Teilnehmende" value={memberCount} href={`/c/${slug}/teilnehmende`} />
        <StatTile label="Konten mit Zugang" value={accounts.length} />
        <StatTile label="Offene Einladungen" value={invitations.length} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title="Konten mit Zugang"
              description="Personen, die sich anmelden können."
            />
            <CardBody className={accounts.length === 0 ? 'p-0' : undefined}>
              {accounts.length === 0 ? (
                <EmptyState title="Noch niemand hat einen Zugang" />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {accounts.map((account) => (
                    <li key={account.id} className="py-3 first:pt-0">
                      <AccountRow
                        account={{
                          personId: account.person.id,
                          name:
                            account.person.displayName ||
                            `${account.person.firstName} ${account.person.lastName}`.trim(),
                          initials: initials(
                            account.person.firstName,
                            account.person.lastName || account.person.firstName,
                          ),
                          email: account.person.primaryEmail,
                          roles: account.roles.map((link) => link.role.name),
                          lastLogin: account.person.lastLoginAt
                            ? formatDateTime(account.person.lastLoginAt)
                            : null,
                          isSuperAdmin: account.person.isSuperAdmin,
                          mustChangePassword: account.person.mustChangePassword,
                          locked:
                            account.person.lockedUntil !== null &&
                            account.person.lockedUntil.getTime() > Date.now(),
                          isSelf: account.person.id === context.user.id,
                          membershipHref: `/c/${slug}/teilnehmende/${account.id}`,
                        }}
                        canManage={canManageAccounts}
                        resetAction={resetPasswordAction.bind(null, slug, account.person.id)}
                        revokeAction={revokeAccessAction.bind(null, slug, account.person.id)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Rollen</h2>
            {roles.map((role) => (
              <RoleCard
                key={role.id}
                role={{
                  id: role.id,
                  key: role.key,
                  name: role.name,
                  description: role.description,
                  rank: role.rank,
                  isSystem: role.isSystem,
                  memberCount: role._count.memberships,
                  permissions: parsePermissions(role.permissions),
                }}
                permissionGroups={permissionGroups}
                canManage={canManageRoles}
                saveAction={saveRoleAction.bind(null, slug, role.id)}
                deleteAction={deleteRoleAction.bind(null, slug, role.id)}
              />
            ))}
          </div>
        </div>

        <div className="space-y-6">
          {canManageAccounts ? (
            <>
              <Card>
                <CardHeader title="Zugang einladen" description="Die Person richtet ihr Passwort selbst ein." />
                <CardBody>
                  <InviteForm
                    action={inviteAccountAction.bind(null, slug)}
                    roles={roles.map((role) => ({ id: role.id, name: role.name }))}
                  />
                </CardBody>
              </Card>

              {invitations.length > 0 ? (
                <Card>
                  <CardHeader title="Offene Einladungen" />
                  <CardBody>
                    <ul className="space-y-2">
                      {invitations.map((invitation) => (
                        <li key={invitation.id} className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm text-slate-800">{invitation.email}</p>
                            <p className="text-xs text-slate-500">
                              {invitation.role ? `${invitation.role.name} · ` : ''}
                              gültig bis {formatDate(invitation.expiresAt)}
                            </p>
                          </div>
                          <form action={revokeInvitationAction.bind(null, slug, invitation.id)}>
                            <button
                              type="submit"
                              className="rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-red-50 hover:text-red-700"
                            >
                              Zurückziehen
                            </button>
                          </form>
                        </li>
                      ))}
                    </ul>
                  </CardBody>
                </Card>
              ) : null}
            </>
          ) : null}

          {canManageRoles ? (
            <Card>
              <CardHeader title="Neue Rolle" />
              <CardBody>
                <RoleForm
                  action={saveRoleAction.bind(null, slug, null)}
                  idPrefix="neu"
                  submitLabel="Rolle anlegen"
                  permissionGroups={permissionGroups}
                />
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Gut zu wissen" />
            <CardBody className="space-y-2 text-sm text-slate-600">
              <p>
                Die Rechte einer Person ergeben sich aus allen Rollen, die ihr zugewiesen sind.
                Rollen weisen Sie im{' '}
                <Link href={`/c/${slug}/teilnehmende`} className="text-brand-700 hover:underline">
                  Stammdatensatz
                </Link>{' '}
                zu.
              </p>
              <p>
                Die Rolle Leitung behält stets alle Rechte, damit sich niemand versehentlich
                aussperrt.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
