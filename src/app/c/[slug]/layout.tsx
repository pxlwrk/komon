import { AppShell } from '@/components/app-shell';
import type { NavSection } from '@/components/sidebar-nav';
import { setActiveCommunity } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requireCommunity } from '@/lib/rbac';

export default async function CommunityLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const context = await requireCommunity(slug);
  const base = `/c/${slug}`;

  // Die zuletzt geoeffnete Community wird fuer den naechsten Besuch gemerkt.
  if (context.user.activeCommunityId !== context.community.id) {
    await setActiveCommunity(context.user.sessionId, context.community.id);
  }

  const [pendingListMessages, pendingInvitations] = await Promise.all([
    context.can('list.moderate')
      ? prisma.listMessage.count({
          where: { status: 'PENDING', list: { communityId: context.community.id } },
        })
      : Promise.resolve(0),
    context.can('event.manage')
      ? prisma.eventParticipation.count({
          where: {
            status: 'INVITED',
            event: { communityId: context.community.id, status: { in: ['PUBLISHED', 'PLANNING'] } },
          },
        })
      : Promise.resolve(0),
  ]);

  const sections: NavSection[] = [
    {
      items: [{ href: base, label: 'Überblick', exact: true }],
    },
    {
      title: 'Menschen',
      items: [
        context.can('member.view') ? { href: `${base}/teilnehmende`, label: 'Teilnehmende' } : null,
        context.can('group.view') ? { href: `${base}/gruppen`, label: 'Gruppen' } : null,
      ].filter(Boolean) as NavSection['items'],
    },
    {
      title: 'Kommunikation',
      items: [
        context.can('mail.view') ? { href: `${base}/nachrichten`, label: 'Nachrichten' } : null,
        context.can('list.view')
          ? { href: `${base}/listen`, label: 'Mailinglisten', badge: pendingListMessages }
          : null,
      ].filter(Boolean) as NavSection['items'],
    },
    {
      title: 'Inhalte',
      items: [
        context.can('file.view') ? { href: `${base}/dateien`, label: 'Dateiablage' } : null,
        context.can('journal.view') ? { href: `${base}/journal`, label: 'Content-Journal' } : null,
      ].filter(Boolean) as NavSection['items'],
    },
    {
      title: 'Termine',
      items: [
        context.can('event.view')
          ? { href: `${base}/events`, label: 'Events', badge: pendingInvitations }
          : null,
        context.can('calendar.view') ? { href: `${base}/kalender`, label: 'Kalender' } : null,
      ].filter(Boolean) as NavSection['items'],
    },
    {
      title: 'Verwaltung',
      items: [
        context.canAny('role.view', 'account.manage')
          ? { href: `${base}/benutzer`, label: 'Benutzer und Rechte' }
          : null,
        context.can('community.manage')
          ? { href: `${base}/einstellungen`, label: 'Einstellungen' }
          : null,
        context.can('audit.view') ? { href: `${base}/protokoll`, label: 'Protokoll' } : null,
      ].filter(Boolean) as NavSection['items'],
    },
  ].filter((section) => section.items.length > 0);

  return (
    <AppShell user={context.user} activeSlug={slug} sections={sections}>
      {children}
    </AppShell>
  );
}
