import Link from 'next/link';
import type { Prisma } from '@prisma/client';

import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  LinkButton,
  PageHeader,
  Table,
  Td,
  Th,
  statusTone,
} from '@/components/ui';
import { MEMBERSHIP_STATUS, label, membershipStatusValues } from '@/lib/enums';
import { formatDate, initials } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';

import { MemberFilters } from './filters';

export const metadata = { title: 'Teilnehmende' };

const PAGE_SIZE = 25;

export default async function MembersPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; status?: string; gruppe?: string; tag?: string; seite?: string }>;
}) {
  const { slug } = await params;
  const context = await requirePermission(slug, 'member.view');
  const query = await searchParams;

  const page = Math.max(1, Number.parseInt(query.seite ?? '1', 10) || 1);
  const search = (query.q ?? '').trim();

  const where: Prisma.MembershipWhereInput = {
    communityId: context.community.id,
    ...(query.status && membershipStatusValues.includes(query.status as never)
      ? { status: query.status }
      : {}),
    ...(query.gruppe ? { groupMembers: { some: { groupId: query.gruppe } } } : {}),
    ...(query.tag ? { tags: { some: { tagId: query.tag } } } : {}),
    ...(search
      ? {
          person: {
            OR: [
              { firstName: { contains: search } },
              { lastName: { contains: search } },
              { primaryEmail: { contains: search } },
              { organization: { contains: search } },
              { city: { contains: search } },
            ],
          },
        }
      : {}),
  };

  const [total, memberships, groups, tags, statusCounts] = await Promise.all([
    prisma.membership.count({ where }),
    prisma.membership.findMany({
      where,
      include: {
        person: true,
        roles: { include: { role: { select: { name: true } } } },
        tags: { include: { tag: { select: { id: true, name: true, color: true } } } },
      },
      orderBy: [{ person: { lastName: 'asc' } }, { person: { firstName: 'asc' } }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.group.findMany({
      where: { communityId: context.community.id },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.tag.findMany({
      where: { communityId: context.community.id },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.membership.groupBy({
      by: ['status'],
      where: { communityId: context.community.id },
      _count: { _all: true },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const exportHref = `/api/c/${slug}/teilnehmende/export${search ? `?q=${encodeURIComponent(search)}` : ''}`;

  return (
    <>
      <PageHeader
        title="Teilnehmende"
        description={`${total} ${total === 1 ? 'Eintrag' : 'Einträge'} in ${context.community.name}`}
        actions={
          <>
            {context.can('member.export') ? (
              <LinkButton href={exportHref} variant="secondary" prefetch={false}>
                Als CSV exportieren
              </LinkButton>
            ) : null}
            {context.can('member.create') ? (
              <>
                <LinkButton href={`/c/${slug}/teilnehmende/import`} variant="secondary">
                  Importieren
                </LinkButton>
                <LinkButton href={`/c/${slug}/teilnehmende/neu`}>Person aufnehmen</LinkButton>
              </>
            ) : null}
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {statusCounts
          .sort((a, b) => b._count._all - a._count._all)
          .map((entry) => (
            <Badge key={entry.status} tone={statusTone(entry.status)}>
              {label(MEMBERSHIP_STATUS, entry.status)}: {entry._count._all}
            </Badge>
          ))}
      </div>

      <Card className="mb-4 p-4">
        <MemberFilters
          basePath={`/c/${slug}/teilnehmende`}
          groups={groups}
          tags={tags}
          current={{ q: search, status: query.status ?? '', gruppe: query.gruppe ?? '', tag: query.tag ?? '' }}
        />
      </Card>

      <Card>
        {memberships.length === 0 ? (
          <EmptyState
            title="Keine Einträge gefunden"
            description={
              search || query.status || query.gruppe || query.tag
                ? 'Passen Sie die Suche oder die Filter an.'
                : 'Nehmen Sie die erste Person in diese Community auf.'
            }
            action={
              context.can('member.create') ? (
                <LinkButton href={`/c/${slug}/teilnehmende/neu`}>Person aufnehmen</LinkButton>
              ) : null
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Person</Th>
                <Th className="hidden md:table-cell">Kontakt</Th>
                <Th className="hidden lg:table-cell">Rollen</Th>
                <Th className="hidden xl:table-cell">Dabei seit</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {memberships.map((membership) => {
                const person = membership.person;
                const name = person.displayName || `${person.firstName} ${person.lastName}`.trim();
                return (
                  <tr key={membership.id} className="transition hover:bg-slate-50">
                    <Td>
                      <Link
                        href={`/c/${slug}/teilnehmende/${membership.id}`}
                        className="flex items-center gap-3"
                      >
                        <Avatar initials={initials(person.firstName, person.lastName || person.firstName)} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-slate-900">{name}</span>
                          <span className="block truncate text-xs text-slate-500">
                            {person.organization || person.city || person.primaryEmail}
                          </span>
                          {membership.tags.length > 0 ? (
                            <span className="mt-1 flex flex-wrap gap-1">
                              {membership.tags.map((link) => (
                                <Badge key={link.tag.id} tone="brand">
                                  {link.tag.name}
                                </Badge>
                              ))}
                            </span>
                          ) : null}
                        </span>
                      </Link>
                    </Td>
                    <Td className="hidden md:table-cell">
                      <span className="block truncate text-sm">{person.primaryEmail}</span>
                      {person.phone || person.mobile ? (
                        <span className="block text-xs text-slate-500">{person.mobile || person.phone}</span>
                      ) : null}
                    </Td>
                    <Td className="hidden lg:table-cell">
                      <span className="text-xs text-slate-600">
                        {membership.roles.map((link) => link.role.name).join(', ') || 'Ohne Rolle'}
                      </span>
                    </Td>
                    <Td className="hidden xl:table-cell text-xs text-slate-500">
                      {formatDate(membership.joinedAt)}
                    </Td>
                    <Td>
                      <Badge tone={statusTone(membership.status)}>
                        {label(MEMBERSHIP_STATUS, membership.status)}
                      </Badge>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      {totalPages > 1 ? (
        <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Seiten">
          <span className="text-slate-500">
            Seite {page} von {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <LinkButton
                variant="secondary"
                size="sm"
                href={buildPageHref(`/c/${slug}/teilnehmende`, query, page - 1)}
              >
                Zurück
              </LinkButton>
            ) : null}
            {page < totalPages ? (
              <LinkButton
                variant="secondary"
                size="sm"
                href={buildPageHref(`/c/${slug}/teilnehmende`, query, page + 1)}
              >
                Weiter
              </LinkButton>
            ) : null}
          </div>
        </nav>
      ) : null}
    </>
  );
}

function buildPageHref(
  base: string,
  query: { q?: string; status?: string; gruppe?: string; tag?: string },
  page: number,
): string {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.status) params.set('status', query.status);
  if (query.gruppe) params.set('gruppe', query.gruppe);
  if (query.tag) params.set('tag', query.tag);
  params.set('seite', String(page));
  return `${base}?${params.toString()}`;
}
