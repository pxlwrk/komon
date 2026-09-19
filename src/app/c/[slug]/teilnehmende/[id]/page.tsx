import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  Avatar,
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  statusTone,
} from '@/components/ui';
import {
  MAIL_PREFERENCE,
  MEMBERSHIP_STATUS,
  PARTICIPATION_STATUS,
  PERSON_STATUS,
  SUBSCRIPTION_STATUS,
  label,
} from '@/lib/enums';
import { formatDate, formatDateTime, initials } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';

import {
  addEmailAddressAction,
  removeEmailAddressAction,
  removeMemberAction,
  setMemberGroupsAction,
  setMemberRolesAction,
  setMemberTagsAction,
  updateMemberAction,
} from '../actions';
import { MemberForm } from '../member-form';
import {
  parseFieldOptions,
  type CustomFieldDefinitionView,
  type MemberFormValues,
} from '../member-values';
import {
  EmailAddressSection,
  GroupSection,
  RemoveMemberButton,
  RoleSection,
  TagSection,
} from './sections';

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const context = await requirePermission(slug, 'member.view');

  const membership = await prisma.membership.findFirst({
    where: { id, communityId: context.community.id },
    include: {
      person: {
        include: {
          emailAddresses: { orderBy: [{ isPrimary: 'desc' }, { address: 'asc' }] },
          listSubscriptions: {
            where: { list: { communityId: context.community.id } },
            include: { list: { select: { id: true, name: true, address: true } } },
          },
          participations: {
            where: { event: { communityId: context.community.id } },
            include: { event: { select: { id: true, title: true, startAt: true, status: true } } },
            orderBy: { event: { startAt: 'desc' } },
            take: 10,
          },
        },
      },
      roles: { include: { role: true } },
      groupMembers: { include: { group: true } },
      tags: { include: { tag: true } },
      fieldValues: { include: { definition: true } },
    },
  });

  if (!membership) notFound();

  const person = membership.person;
  const name = person.displayName || `${person.firstName} ${person.lastName}`.trim();
  const canEdit = context.can('member.update');

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

  const customValues: MemberFormValues['customValues'] = {};
  for (const entry of membership.fieldValues) {
    customValues[entry.definition.key] =
      entry.definition.type === 'MULTISELECT' ? parseFieldOptions(entry.value) : entry.value;
  }

  const values: MemberFormValues = {
    salutation: person.salutation,
    title: person.title,
    firstName: person.firstName,
    lastName: person.lastName,
    displayName: person.displayName,
    pronouns: person.pronouns,
    primaryEmail: person.primaryEmail,
    phone: person.phone,
    mobile: person.mobile,
    street: person.street,
    postalCode: person.postalCode,
    city: person.city,
    region: person.region,
    country: person.country,
    birthDate: person.birthDate ? person.birthDate.toISOString().slice(0, 10) : null,
    organization: person.organization,
    jobTitle: person.jobTitle,
    website: person.website,
    notes: person.notes,
    memberNumber: membership.memberNumber,
    position: membership.position,
    membershipStatus: membership.status,
    personStatus: person.status,
    mailPreference: membership.mailPreference,
    allowBulkEmail: membership.allowBulkEmail,
    customValues,
  };

  const [roles, groups] = await Promise.all([
    context.can('role.manage')
      ? prisma.role.findMany({
          where: { communityId: context.community.id },
          orderBy: [{ rank: 'asc' }, { name: 'asc' }],
        })
      : Promise.resolve([]),
    context.can('group.manage')
      ? prisma.group.findMany({
          where: { communityId: context.community.id, type: 'STATIC' },
          orderBy: { name: 'asc' },
        })
      : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Avatar
              initials={initials(person.firstName, person.lastName || person.firstName)}
              className="h-10 w-10 text-sm"
            />
            {name}
          </span>
        }
        description={[person.jobTitle, person.organization].filter(Boolean).join(' bei ') || person.primaryEmail}
        breadcrumb={
          <Link href={`/c/${slug}/teilnehmende`} className="hover:text-slate-700">
            Teilnehmende
          </Link>
        }
        actions={
          context.can('member.delete') ? (
            <RemoveMemberButton action={removeMemberAction.bind(null, slug, membership.id)} name={name} />
          ) : null
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <Badge tone={statusTone(membership.status)}>
          Mitgliedschaft: {label(MEMBERSHIP_STATUS, membership.status)}
        </Badge>
        <Badge tone={statusTone(person.status)}>Person: {label(PERSON_STATUS, person.status)}</Badge>
        <Badge>Dabei seit {formatDate(membership.joinedAt)}</Badge>
        <Badge>{label(MAIL_PREFERENCE, membership.mailPreference)}</Badge>
        {membership.memberNumber ? <Badge>Nr. {membership.memberNumber}</Badge> : null}
        {person.passwordHash ? <Badge tone="brand">Benutzerkonto vorhanden</Badge> : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {canEdit ? (
            <MemberForm
              action={updateMemberAction.bind(null, slug, membership.id)}
              values={values}
              customFields={customFields}
              cancelHref={`/c/${slug}/teilnehmende`}
              submitLabel="Änderungen speichern"
            />
          ) : (
            <ReadOnlyProfile values={values} customFields={customFields} />
          )}
        </div>

        <div className="space-y-6">
          <TagSection
            action={setMemberTagsAction.bind(null, slug, membership.id)}
            tags={membership.tags.map((link) => link.tag.name)}
            canEdit={canEdit}
          />

          <EmailAddressSection
            addAction={addEmailAddressAction.bind(null, slug, membership.id)}
            removeAction={removeEmailAddressAction.bind(null, slug, membership.id)}
            addresses={person.emailAddresses.map((address) => ({
              id: address.id,
              address: address.address,
              label: address.label,
              isPrimary: address.isPrimary,
              status: address.status,
            }))}
            canEdit={canEdit}
          />

          {context.can('role.manage') ? (
            <RoleSection
              action={setMemberRolesAction.bind(null, slug, membership.id)}
              roles={roles.map((role) => ({ id: role.id, name: role.name, description: role.description }))}
              selected={membership.roles.map((link) => link.roleId)}
            />
          ) : (
            <Card>
              <CardHeader title="Rollen" />
              <CardBody>
                <p className="text-sm text-slate-600">
                  {membership.roles.map((link) => link.role.name).join(', ') || 'Keine Rolle zugewiesen.'}
                </p>
              </CardBody>
            </Card>
          )}

          {context.can('group.manage') ? (
            <GroupSection
              action={setMemberGroupsAction.bind(null, slug, membership.id)}
              groups={groups.map((group) => ({ id: group.id, name: group.name }))}
              selected={membership.groupMembers.map((link) => link.groupId)}
            />
          ) : membership.groupMembers.length > 0 ? (
            <Card>
              <CardHeader title="Gruppen" />
              <CardBody>
                <div className="flex flex-wrap gap-1.5">
                  {membership.groupMembers.map((link) => (
                    <Badge key={link.groupId} tone="brand">
                      {link.group.name}
                    </Badge>
                  ))}
                </div>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Mailinglisten" />
            <CardBody>
              {person.listSubscriptions.length === 0 ? (
                <p className="text-sm text-slate-500">In keiner Liste eingetragen.</p>
              ) : (
                <ul className="space-y-2">
                  {person.listSubscriptions.map((subscription) => (
                    <li key={subscription.id} className="flex items-start justify-between gap-2">
                      <Link
                        href={`/c/${slug}/listen/${subscription.list.id}`}
                        className="min-w-0 text-sm text-slate-700 hover:text-brand-700"
                      >
                        <span className="block truncate font-medium">{subscription.list.name}</span>
                        <span className="block truncate text-xs text-slate-500">
                          {subscription.list.address}
                        </span>
                      </Link>
                      <Badge tone={statusTone(subscription.status)}>
                        {label(SUBSCRIPTION_STATUS, subscription.status)}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Events" description="Die letzten Teilnahmen" />
            <CardBody>
              {person.participations.length === 0 ? (
                <EmptyState title="Noch keine Teilnahme erfasst" />
              ) : (
                <ul className="space-y-2">
                  {person.participations.map((participation) => (
                    <li key={participation.id} className="flex items-start justify-between gap-2">
                      <Link
                        href={`/c/${slug}/events/${participation.event.id}`}
                        className="min-w-0 text-sm text-slate-700 hover:text-brand-700"
                      >
                        <span className="block truncate font-medium">{participation.event.title}</span>
                        <span className="block text-xs text-slate-500">
                          {formatDateTime(participation.event.startAt)}
                        </span>
                      </Link>
                      <Badge tone={statusTone(participation.status)}>
                        {label(PARTICIPATION_STATUS, participation.status)}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

function ReadOnlyProfile({
  values,
  customFields,
}: {
  values: MemberFormValues;
  customFields: CustomFieldDefinitionView[];
}) {
  const rows: [string, string | null][] = [
    ['E-Mail', values.primaryEmail],
    ['Telefon', values.phone],
    ['Mobil', values.mobile],
    ['Anschrift', [values.street, [values.postalCode, values.city].filter(Boolean).join(' '), values.country].filter(Boolean).join(', ') || null],
    ['Organisation', values.organization],
    ['Funktion', values.jobTitle],
    ['Internetseite', values.website],
    ['Funktion in der Community', values.position],
  ];

  return (
    <Card>
      <CardHeader title="Stammdaten" />
      <CardBody>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {rows
            .filter(([, value]) => value)
            .map(([key, value]) => (
              <div key={key}>
                <dt className="text-xs uppercase tracking-wide text-slate-500">{key}</dt>
                <dd className="text-sm text-slate-800">{value}</dd>
              </div>
            ))}
          {customFields.map((definition) => {
            const value = values.customValues[definition.key];
            const text = Array.isArray(value) ? value.join(', ') : value;
            if (!text) return null;
            return (
              <div key={definition.id}>
                <dt className="text-xs uppercase tracking-wide text-slate-500">{definition.label}</dt>
                <dd className="text-sm text-slate-800">{text}</dd>
              </div>
            );
          })}
        </dl>
      </CardBody>
    </Card>
  );
}
