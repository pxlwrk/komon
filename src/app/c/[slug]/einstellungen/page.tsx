import { Badge, Card, CardBody, CardHeader, PageHeader } from '@/components/ui';
import { CUSTOM_FIELD_TYPE, CUSTOM_FIELD_VISIBILITY, customFieldTypeValues, customFieldVisibilityValues, label } from '@/lib/enums';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';

import {
  createTagAction,
  deleteCustomFieldAction,
  deleteTagAction,
  saveCustomFieldAction,
  updateCommunityAction,
} from './actions';
import { CommunityForm, CustomFieldCard, CustomFieldForm, TagManager } from './settings-ui';

export const metadata = { title: 'Einstellungen' };

const TIMEZONES = [
  'Europe/Berlin',
  'Europe/Vienna',
  'Europe/Zurich',
  'Europe/London',
  'Europe/Paris',
  'UTC',
];

export default async function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const context = await requirePermission(slug, 'community.manage');

  const [community, fields, tags] = await Promise.all([
    prisma.community.findUniqueOrThrow({ where: { id: context.community.id } }),
    prisma.customFieldDefinition.findMany({
      where: { communityId: context.community.id },
      orderBy: [{ position: 'asc' }, { label: 'asc' }],
      include: { _count: { select: { values: true } } },
    }),
    prisma.tag.findMany({
      where: { communityId: context.community.id },
      orderBy: { name: 'asc' },
      include: { _count: { select: { memberships: true, journal: true, events: true } } },
    }),
  ]);

  const typeOptions = customFieldTypeValues.map((value) => ({ value, title: CUSTOM_FIELD_TYPE[value] }));
  const visibilityOptions = customFieldVisibilityValues.map((value) => ({
    value,
    title: CUSTOM_FIELD_VISIBILITY[value],
  }));

  return (
    <>
      <PageHeader
        title="Einstellungen"
        description={`Grunddaten, Stammdatenfelder und Schlagworte von ${community.name}.`}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Grunddaten" />
            <CardBody>
              <CommunityForm
                action={updateCommunityAction.bind(null, slug)}
                timezones={TIMEZONES}
                values={{
                  name: community.name,
                  description: community.description,
                  purpose: community.purpose,
                  timezone: community.timezone,
                  mailDomain: community.mailDomain,
                  senderEmail: community.senderEmail,
                  senderName: community.senderName,
                  accentColor: community.accentColor,
                  status: community.status,
                  slug: community.slug,
                }}
              />
            </CardBody>
          </Card>

          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Eigene Stammdatenfelder
            </h2>

            {fields.length === 0 ? (
              <Card>
                <CardBody>
                  <p className="text-sm text-slate-500">
                    Noch keine eigenen Felder. Legen Sie rechts das erste an, etwa für einen
                    Beitragssatz oder eine Mitgliedsart.
                  </p>
                </CardBody>
              </Card>
            ) : (
              fields.map((field) => (
                <CustomFieldCard
                  key={field.id}
                  field={{
                    id: field.id,
                    key: field.key,
                    label: field.label,
                    type: field.type,
                    typeLabel: label(CUSTOM_FIELD_TYPE, field.type),
                    description: field.description,
                    options: parseOptions(field.options).join('\n'),
                    required: field.required,
                    visibility: field.visibility,
                    visibilityLabel: label(CUSTOM_FIELD_VISIBILITY, field.visibility),
                    position: field.position,
                    usageCount: field._count.values,
                  }}
                  typeOptions={typeOptions}
                  visibilityOptions={visibilityOptions}
                  saveAction={saveCustomFieldAction.bind(null, slug, field.id)}
                  deleteAction={deleteCustomFieldAction.bind(null, slug, field.id)}
                />
              ))
            )}
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Neues Stammdatenfeld" />
            <CardBody>
              <CustomFieldForm
                action={saveCustomFieldAction.bind(null, slug, null)}
                idPrefix="neu"
                submitLabel="Feld anlegen"
                typeOptions={typeOptions}
                visibilityOptions={visibilityOptions}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Schlagworte" description="Ordnen Teilnehmende, Events und Journaleinträge." />
            <CardBody>
              <TagManager
                tags={tags.map((tag) => ({
                  id: tag.id,
                  name: tag.name,
                  usage: tag._count.memberships + tag._count.journal + tag._count.events,
                  deleteAction: deleteTagAction.bind(null, slug, tag.id),
                }))}
                createAction={createTagAction.bind(null, slug)}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Adresse dieser Community" />
            <CardBody className="space-y-2 text-sm text-slate-600">
              <p className="break-all">
                Kurzadresse: <Badge tone="brand">{community.slug}</Badge>
              </p>
              <p>
                Die Kurzadresse steckt in allen Verweisen auf diese Community und bleibt daher
                unverändert.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

function parseOptions(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}
