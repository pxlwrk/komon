import Link from 'next/link';

import { PageHeader } from '@/components/ui';
import { MEMBERSHIP_STATUS, membershipStatusValues } from '@/lib/enums';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';

import { composeMessageAction } from '../actions';
import { ComposeForm } from './compose-form';

export const metadata = { title: 'Nachricht verfassen' };

export default async function ComposePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ vorlage?: string; gruppe?: string; betreff?: string; text?: string }>;
}) {
  const { slug } = await params;
  const context = await requirePermission(slug, 'mail.compose');
  const query = await searchParams;

  const [groups, tags, templates, memberships] = await Promise.all([
    prisma.group.findMany({
      where: { communityId: context.community.id },
      orderBy: { name: 'asc' },
      include: { _count: { select: { members: true } } },
    }),
    prisma.tag.findMany({
      where: { communityId: context.community.id },
      orderBy: { name: 'asc' },
      include: { _count: { select: { memberships: true } } },
    }),
    prisma.emailTemplate.findMany({
      where: { communityId: context.community.id },
      orderBy: { name: 'asc' },
    }),
    prisma.membership.findMany({
      where: { communityId: context.community.id, status: { in: ['ACTIVE', 'PENDING', 'PAUSED'] } },
      include: {
        person: { select: { firstName: true, lastName: true, displayName: true, primaryEmail: true } },
      },
      orderBy: [{ person: { lastName: 'asc' } }, { person: { firstName: 'asc' } }],
    }),
  ]);

  const reachable = await prisma.membership.count({
    where: {
      communityId: context.community.id,
      status: { in: ['ACTIVE', 'PENDING', 'PAUSED'] },
      allowBulkEmail: true,
      mailPreference: { not: 'NONE' },
      person: { status: 'ACTIVE' },
    },
  });

  const statusOptions = membershipStatusValues.map((value) => ({
    value,
    label: MEMBERSHIP_STATUS[value],
  }));

  // Vorbelegung entweder aus einer Vorlage oder aus einem Journaleintrag.
  const chosen = query.vorlage ? templates.find((entry) => entry.id === query.vorlage) : undefined;
  const template = chosen
    ? { subject: chosen.subject, bodyText: chosen.bodyText }
    : query.betreff || query.text
      ? { subject: query.betreff ?? '', bodyText: query.text ?? '' }
      : null;

  return (
    <>
      <PageHeader
        title="Nachricht verfassen"
        description="Rundschreiben an Ihre Community. Platzhalter wie {{vorname}} werden je Empfängerin ersetzt."
        breadcrumb={
          <Link href={`/c/${slug}/nachrichten`} className="hover:text-slate-700">
            Nachrichten
          </Link>
        }
      />

      <ComposeForm
        action={composeMessageAction.bind(null, slug)}
        cancelHref={`/c/${slug}/nachrichten`}
        canSend={context.can('mail.send')}
        reachable={reachable}
        defaultGroupId={query.gruppe ?? ''}
        template={template}
        templates={templates.map((entry) => ({ id: entry.id, name: entry.name }))}
        groups={groups.map((group) => ({
          id: group.id,
          name: group.name,
          count: group._count.members,
        }))}
        tags={tags.map((tag) => ({ id: tag.id, name: tag.name, count: tag._count.memberships }))}
        statusOptions={statusOptions}
        members={memberships.map((membership) => ({
          id: membership.id,
          name:
            membership.person.displayName ||
            `${membership.person.lastName}, ${membership.person.firstName}`.replace(/^, /, ''),
          email: membership.person.primaryEmail,
          reachable: membership.allowBulkEmail && membership.mailPreference !== 'NONE',
        }))}
      />
    </>
  );
}
