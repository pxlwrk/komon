import Link from 'next/link';

import { PageHeader } from '@/components/ui';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';

import { createJournalEntryAction } from '../actions';
import { JournalForm } from '../journal-form';
import { defaultJournalValues } from '../journal-values';

export const metadata = { title: 'Journaleintrag anlegen' };

export default async function NewJournalEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ event?: string; art?: string }>;
}) {
  const { slug } = await params;
  const context = await requirePermission(slug, 'journal.write');
  const query = await searchParams;

  const events = await prisma.event.findMany({
    where: { communityId: context.community.id },
    orderBy: { startAt: 'desc' },
    select: { id: true, title: true },
    take: 100,
  });

  const values = defaultJournalValues();
  if (query.event) values.eventId = query.event;
  if (query.art) values.type = query.art;

  return (
    <>
      <PageHeader
        title="Neuer Journaleintrag"
        description="Halten Sie Beschlüsse, Protokolle und geplante Beiträge an einem Ort fest."
        breadcrumb={
          <Link href={`/c/${slug}/journal`} className="hover:text-slate-700">
            Content-Journal
          </Link>
        }
      />

      <JournalForm
        action={createJournalEntryAction.bind(null, slug)}
        values={values}
        events={events}
        canPublish={context.can('journal.publish')}
        cancelHref={`/c/${slug}/journal`}
        submitLabel="Eintrag anlegen"
      />
    </>
  );
}
