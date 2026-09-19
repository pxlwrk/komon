'use client';

import { useActionState, useState } from 'react';

import { FieldError, FormMessage, SubmitButton } from '@/components/form';
import { Badge, Button, Card, CardBody, CardHeader, Field } from '@/components/ui';
import { idleState, type ActionState } from '@/lib/action-state';

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;
type Option = { value: string; title: string };

export function CommunityForm({
  action,
  timezones,
  values,
}: {
  action: FormAction;
  timezones: string[];
  values: {
    name: string;
    description: string | null;
    purpose: string | null;
    timezone: string;
    mailDomain: string | null;
    senderEmail: string | null;
    senderName: string | null;
    accentColor: string;
    status: string;
    slug: string;
  };
}) {
  const [state, formAction] = useActionState(action, idleState);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />

      <Field label="Name" htmlFor="name" required>
        <input id="name" name="name" required defaultValue={values.name} />
        <FieldError state={state} name="name" />
      </Field>

      <Field label="Beschreibung" htmlFor="description">
        <textarea id="description" name="description" rows={3} defaultValue={values.description ?? ''} />
      </Field>

      <Field label="Zweck und Leitgedanke" htmlFor="purpose" hint="Wofür steht diese Community?">
        <textarea id="purpose" name="purpose" rows={3} defaultValue={values.purpose ?? ''} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Zeitzone" htmlFor="timezone">
          <select id="timezone" name="timezone" defaultValue={values.timezone}>
            {timezones.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Status" htmlFor="status">
          <select id="status" name="status" defaultValue={values.status}>
            <option value="ACTIVE">Aktiv</option>
            <option value="ARCHIVED">Archiviert</option>
          </select>
        </Field>

        <Field
          label="Domain für Gruppenmailadressen"
          htmlFor="mailDomain"
          hint="Alle Listen enden auf dieser Domain, etwa listen.example.org."
        >
          <input id="mailDomain" name="mailDomain" defaultValue={values.mailDomain ?? ''} />
          <FieldError state={state} name="mailDomain" />
        </Field>

        <Field label="Absendername" htmlFor="senderName">
          <input id="senderName" name="senderName" defaultValue={values.senderName ?? ''} />
        </Field>

        <Field label="Absenderadresse" htmlFor="senderEmail">
          <input id="senderEmail" name="senderEmail" type="email" defaultValue={values.senderEmail ?? ''} />
          <FieldError state={state} name="senderEmail" />
        </Field>

        <Field label="Akzentfarbe" htmlFor="accentColor">
          <input id="accentColor" name="accentColor" defaultValue={values.accentColor} placeholder="#1c66f0" />
        </Field>
      </div>

      <SubmitButton pendingLabel="Wird gespeichert">Einstellungen speichern</SubmitButton>
    </form>
  );
}

export function CustomFieldForm({
  action,
  idPrefix,
  submitLabel,
  typeOptions,
  visibilityOptions,
  values,
}: {
  action: FormAction;
  idPrefix: string;
  submitLabel: string;
  typeOptions: Option[];
  visibilityOptions: Option[];
  values?: {
    label: string;
    type: string;
    description: string | null;
    options: string;
    required: boolean;
    visibility: string;
    position: number;
  };
}) {
  const [state, formAction] = useActionState(action, idleState);
  const [type, setType] = useState(values?.type ?? 'TEXT');
  const id = (name: string) => `${idPrefix}-cf-${name}`;
  const needsOptions = type === 'SELECT' || type === 'MULTISELECT';

  return (
    <form action={formAction} className="space-y-3">
      <FormMessage state={state} />

      <Field label="Beschriftung" htmlFor={id('label')} required>
        <input id={id('label')} name="label" required defaultValue={values?.label ?? ''} placeholder="Beitragssatz" />
      </Field>

      <Field label="Art" htmlFor={id('type')}>
        <select
          id={id('type')}
          name="type"
          value={type}
          onChange={(event) => setType(event.target.value)}
        >
          {typeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.title}
            </option>
          ))}
        </select>
      </Field>

      {needsOptions ? (
        <Field
          label="Auswahlmöglichkeiten"
          htmlFor={id('options')}
          hint="Eine Möglichkeit je Zeile."
          required
        >
          <textarea id={id('options')} name="options" rows={4} defaultValue={values?.options ?? ''} />
          <FieldError state={state} name="options" />
        </Field>
      ) : null}

      <Field label="Erläuterung" htmlFor={id('description')}>
        <input id={id('description')} name="description" defaultValue={values?.description ?? ''} />
      </Field>

      <Field label="Sichtbarkeit" htmlFor={id('visibility')}>
        <select id={id('visibility')} name="visibility" defaultValue={values?.visibility ?? 'STAFF'}>
          {visibilityOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.title}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Reihenfolge" htmlFor={id('position')}>
        <input id={id('position')} name="position" type="number" defaultValue={values?.position ?? 0} />
      </Field>

      <div className="flex items-center gap-2">
        <input id={id('required')} name="required" type="checkbox" defaultChecked={values?.required ?? false} />
        <label htmlFor={id('required')} className="font-normal">
          Pflichtfeld
        </label>
      </div>

      <SubmitButton pendingLabel="Wird gespeichert">{submitLabel}</SubmitButton>
    </form>
  );
}

export function CustomFieldCard({
  field,
  typeOptions,
  visibilityOptions,
  saveAction,
  deleteAction,
}: {
  field: {
    id: string;
    key: string;
    label: string;
    type: string;
    typeLabel: string;
    description: string | null;
    options: string;
    required: boolean;
    visibility: string;
    visibilityLabel: string;
    position: number;
    usageCount: number;
  };
  typeOptions: Option[];
  visibilityOptions: Option[];
  saveAction: FormAction;
  deleteAction: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  return (
    <Card>
      <CardHeader
        title={field.label}
        description={field.description ?? undefined}
        action={
          <Button variant="ghost" size="sm" onClick={() => setEditing((value) => !value)}>
            {editing ? 'Schließen' : 'Bearbeiten'}
          </Button>
        }
      />
      <CardBody className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          <Badge>{field.typeLabel}</Badge>
          <Badge tone="info">{field.visibilityLabel}</Badge>
          {field.required ? <Badge tone="warning">Pflichtfeld</Badge> : null}
          <Badge>
            {field.usageCount} {field.usageCount === 1 ? 'Eintrag' : 'Einträge'}
          </Badge>
        </div>

        {editing ? (
          <div className="space-y-3 border-t border-slate-100 pt-3">
            <CustomFieldForm
              action={saveAction}
              idPrefix={field.id}
              submitLabel="Feld speichern"
              typeOptions={typeOptions}
              visibilityOptions={visibilityOptions}
              values={field}
            />

            <div className="border-t border-slate-100 pt-3">
              {confirming ? (
                <form action={deleteAction} className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-slate-600">
                    Feld samt {field.usageCount} Einträgen löschen?
                  </span>
                  <SubmitButton variant="danger" size="sm" pendingLabel="Wird gelöscht">
                    Ja, löschen
                  </SubmitButton>
                  <Button variant="secondary" size="sm" type="button" onClick={() => setConfirming(false)}>
                    Abbrechen
                  </Button>
                </form>
              ) : (
                <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
                  Feld löschen
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

export function TagManager({
  tags,
  createAction,
}: {
  tags: { id: string; name: string; usage: number; deleteAction: () => Promise<void> }[];
  createAction: FormAction;
}) {
  const [state, formAction] = useActionState(createAction, idleState);

  return (
    <div className="space-y-4">
      {tags.length === 0 ? (
        <p className="text-sm text-slate-500">Noch keine Schlagworte.</p>
      ) : (
        <ul className="space-y-1.5">
          {tags.map((tag) => (
            <li key={tag.id} className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-sm text-slate-800">{tag.name}</span>
              <div className="flex shrink-0 items-center gap-1">
                <span className="text-xs text-slate-500">{tag.usage}</span>
                <form action={tag.deleteAction}>
                  <button
                    type="submit"
                    className="rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-red-50 hover:text-red-700"
                  >
                    Entfernen
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form action={formAction} className="space-y-2 border-t border-slate-100 pt-3">
        <FormMessage state={state} />
        <Field label="Neues Schlagwort" htmlFor="tag-name">
          <input id="tag-name" name="name" required placeholder="Neuzugang" />
        </Field>
        <SubmitButton variant="secondary" size="sm" pendingLabel="Wird angelegt">
          Anlegen
        </SubmitButton>
      </form>
    </div>
  );
}
