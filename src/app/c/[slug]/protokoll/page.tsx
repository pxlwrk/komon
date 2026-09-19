import Link from 'next/link';

import { Badge, Card, EmptyState, LinkButton, PageHeader, Table, Td, Th } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';

export const metadata = { title: 'Protokoll' };

const PAGE_SIZE = 50;

const ACTION_LABELS: Record<string, string> = {
  'auth.login': 'Anmeldung',
  'community.create': 'Community angelegt',
  'community.update': 'Einstellungen geändert',
  'member.create': 'Person aufgenommen',
  'member.update': 'Stammdaten geändert',
  'member.remove': 'Person entfernt',
  'member.import': 'Import',
  'member.roles': 'Rollen geändert',
  'group.create': 'Gruppe angelegt',
  'group.delete': 'Gruppe gelöscht',
  'role.create': 'Rolle angelegt',
  'role.update': 'Rolle geändert',
  'role.delete': 'Rolle gelöscht',
  'account.invite': 'Einladung versendet',
  'account.accept': 'Einladung angenommen',
  'account.reset': 'Passwort gesetzt',
  'account.revoke': 'Zugang entzogen',
  'mail.compose': 'Nachricht verfasst',
  'mail.send': 'Nachricht freigegeben',
  'list.create': 'Liste angelegt',
  'list.delete': 'Liste gelöscht',
  'list.sync': 'Liste abgeglichen',
  'list.approve': 'Beitrag freigegeben',
  'list.reject': 'Beitrag abgelehnt',
  'folder.create': 'Ordner angelegt',
  'folder.delete': 'Ordner gelöscht',
  'file.upload': 'Dateien abgelegt',
  'file.delete': 'Datei gelöscht',
  'event.create': 'Event angelegt',
  'event.delete': 'Event gelöscht',
  'event.invite': 'Einladungen versendet',
  'event.debrief': 'Nachbereitung',
  'journal.create': 'Journaleintrag angelegt',
  'journal.delete': 'Journaleintrag gelöscht',
};

export default async function AuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ seite?: string; aktion?: string }>;
}) {
  const { slug } = await params;
  const context = await requirePermission(slug, 'audit.view');
  const query = await searchParams;

  const page = Math.max(1, Number.parseInt(query.seite ?? '1', 10) || 1);
  const where = {
    communityId: context.community.id,
    ...(query.aktion ? { action: { startsWith: query.aktion } } : {}),
  };

  const [total, entries, actions] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: { actor: { select: { firstName: true, lastName: true, displayName: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.groupBy({
      by: ['action'],
      where: { communityId: context.community.id },
      _count: { _all: true },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const areas = Array.from(new Set(actions.map((entry) => entry.action.split('.')[0]))).sort();

  return (
    <>
      <PageHeader
        title="Protokoll"
        description={`${total} festgehaltene Vorgänge in ${context.community.name}.`}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href={`/c/${slug}/protokoll`}
          className={
            !query.aktion
              ? 'rounded-full bg-brand-600 px-3 py-1 text-sm font-medium text-white'
              : 'rounded-full border border-slate-300 bg-white px-3 py-1 text-sm text-slate-600 hover:bg-slate-50'
          }
        >
          Alle
        </Link>
        {areas.map((area) => (
          <Link
            key={area}
            href={`/c/${slug}/protokoll?aktion=${area}`}
            className={
              query.aktion === area
                ? 'rounded-full bg-brand-600 px-3 py-1 text-sm font-medium text-white'
                : 'rounded-full border border-slate-300 bg-white px-3 py-1 text-sm text-slate-600 hover:bg-slate-50'
            }
          >
            {area}
          </Link>
        ))}
      </div>

      <Card>
        {entries.length === 0 ? (
          <EmptyState title="Noch keine Einträge" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Zeitpunkt</Th>
                <Th>Vorgang</Th>
                <Th className="hidden md:table-cell">Person</Th>
                <Th>Beschreibung</Th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <Td className="whitespace-nowrap text-xs text-slate-500">
                    {formatDateTime(entry.createdAt)}
                  </Td>
                  <Td>
                    <Badge>{ACTION_LABELS[entry.action] ?? entry.action}</Badge>
                  </Td>
                  <Td className="hidden md:table-cell text-sm">
                    {entry.actor
                      ? entry.actor.displayName ||
                        `${entry.actor.firstName} ${entry.actor.lastName}`.trim()
                      : 'System'}
                  </Td>
                  <Td className="text-sm">{entry.summary}</Td>
                </tr>
              ))}
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
                href={`/c/${slug}/protokoll?seite=${page - 1}${query.aktion ? `&aktion=${query.aktion}` : ''}`}
              >
                Zurück
              </LinkButton>
            ) : null}
            {page < totalPages ? (
              <LinkButton
                variant="secondary"
                size="sm"
                href={`/c/${slug}/protokoll?seite=${page + 1}${query.aktion ? `&aktion=${query.aktion}` : ''}`}
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
