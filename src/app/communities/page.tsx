import Link from 'next/link';

import { AppShell } from '@/components/app-shell';
import { Badge, Card, CardBody, EmptyState, PageHeader } from '@/components/ui';
import { requireUser } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';

import { CreateCommunityForm } from './create-form';

export const metadata = { title: 'Communities' };

export default async function CommunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ neu?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const showCreate = user.isSuperAdmin && params.neu === '1';

  const ids = user.communities.map((entry) => entry.communityId);
  const stats = await prisma.community.findMany({
    where: user.isSuperAdmin ? {} : { id: { in: ids } },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      status: true,
      _count: { select: { memberships: true, events: true, mailingLists: true } },
    },
  });

  return (
    <AppShell user={user} activeSlug={null} sections={[{ items: [{ href: '/communities', label: 'Communities', exact: true }] }]}>
      <PageHeader
        title="Communities"
        description="Alle Gemeinschaften, für die Sie Zugriff haben."
        actions={
          user.isSuperAdmin && !showCreate ? (
            <Link href="/communities?neu=1" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700">
              Neue Community
            </Link>
          ) : null
        }
      />

      {showCreate ? (
        <Card className="mb-6">
          <CardBody>
            <CreateCommunityForm />
          </CardBody>
        </Card>
      ) : null}

      {stats.length === 0 ? (
        <Card>
          <EmptyState
            title="Noch keine Community vorhanden"
            description="Sobald Sie einer Community zugeordnet sind, erscheint sie an dieser Stelle."
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((community) => {
            const access = user.communities.find((entry) => entry.communityId === community.id);
            return (
              <Link
                key={community.id}
                href={`/c/${community.slug}`}
                className="card flex flex-col gap-3 p-5 transition hover:border-brand-300 hover:shadow"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-base font-semibold text-slate-900">{community.name}</h2>
                  {community.status === 'ARCHIVED' ? <Badge tone="neutral">Archiviert</Badge> : null}
                </div>
                {community.description ? (
                  <p className="line-clamp-2 text-sm text-slate-600">{community.description}</p>
                ) : null}
                <dl className="mt-auto grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center">
                  <div>
                    <dt className="text-xs text-slate-500">Teilnehmende</dt>
                    <dd className="text-sm font-semibold tabular-nums text-slate-900">{community._count.memberships}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Events</dt>
                    <dd className="text-sm font-semibold tabular-nums text-slate-900">{community._count.events}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Listen</dt>
                    <dd className="text-sm font-semibold tabular-nums text-slate-900">{community._count.mailingLists}</dd>
                  </div>
                </dl>
                {access ? (
                  <p className="text-xs text-slate-500">Ihre Rolle: {access.roleNames.join(', ') || 'Ohne Rolle'}</p>
                ) : (
                  <p className="text-xs text-slate-500">Zugriff über die Plattformverwaltung</p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
