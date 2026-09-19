import Link from 'next/link';

import { PageHeader } from '@/components/ui';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';

import { createMemberAction } from '../actions';
import { MemberForm } from '../member-form';
import {
  emptyMemberValues,
  parseFieldOptions,
  type CustomFieldDefinitionView,
} from '../member-values';

export const metadata = { title: 'Person aufnehmen' };

export default async function NewMemberPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const context = await requirePermission(slug, 'member.create');

  const definitions = await prisma.customFieldDefinition.findMany({
    where: { communityId: context.community.id },
    orderBy: [{ position: 'asc' }, { label: 'asc' }],
  });

  const customFields: CustomFieldDefinitionView[] = definitions.map((definition) => ({
    id: definition.id,
    key: definition.key,
    label: definition.label,
    type: definition.type,
    description: definition.description,
    required: definition.required,
    options: parseFieldOptions(definition.options),
  }));

  const action = createMemberAction.bind(null, slug);

  return (
    <>
      <PageHeader
        title="Person aufnehmen"
        description="Ist die Person bereits in einer anderen Community erfasst, werden die vorhandenen Stammdaten übernommen."
        breadcrumb={
          <Link href={`/c/${slug}/teilnehmende`} className="hover:text-slate-700">
            Teilnehmende
          </Link>
        }
      />

      <MemberForm
        action={action}
        values={emptyMemberValues()}
        customFields={customFields}
        cancelHref={`/c/${slug}/teilnehmende`}
        submitLabel="Person aufnehmen"
      />
    </>
  );
}
