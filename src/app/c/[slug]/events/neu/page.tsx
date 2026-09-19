import Link from 'next/link';

import { PageHeader } from '@/components/ui';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';

import { createEventAction } from '../actions';
import { EventForm } from '../event-form';
import { defaultEventValues } from '../event-values';

export const metadata = { title: 'Event anlegen' };

export default async function NewEventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const context = await requirePermission(slug, 'event.manage');

  const memberships = await prisma.membership.findMany({
    where: { communityId: context.community.id, status: 'ACTIVE' },
    include: { person: { select: { id: true, firstName: true, lastName: true, displayName: true } } },
    orderBy: [{ person: { lastName: 'asc' } }],
  });

  const values = defaultEventValues();
  values.organizerId = context.user.id;

  return (
    <>
      <PageHeader
        title="Event anlegen"
        description="Planen Sie Termin, Ort und Anmeldung. Einladungen folgen im nächsten Schritt."
        breadcrumb={
          <Link href={`/c/${slug}/events`} className="hover:text-slate-700">
            Events
          </Link>
        }
      />

      <EventForm
        action={createEventAction.bind(null, slug)}
        values={values}
        organizers={memberships.map((membership) => ({
          id: membership.person.id,
          name:
            membership.person.displayName ||
            `${membership.person.firstName} ${membership.person.lastName}`.trim(),
        }))}
        cancelHref={`/c/${slug}/events`}
        submitLabel="Event anlegen"
      />
    </>
  );
}
