'use client';

import { useActionState, useState } from 'react';

import { FieldError, FormMessage, SubmitButton } from '@/components/form';
import { Badge, Button, Field } from '@/components/ui';
import { idleState, type ActionState } from '@/lib/action-state';

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;
type Option = { value: string; title: string };

export type CalendarEntryValues = {
  title: string;
  description: string | null;
  location: string | null;
  startAt: string;
  endAt: string;
  allDay: boolean;
  kind: string;
  visibility: string;
  recurrence: string | null;
};

export function CalendarEntryForm({
  action,
  idPrefix,
  submitLabel,
  kinds,
  visibilities,
  values,
}: {
  action: FormAction;
  idPrefix: string;
  submitLabel: string;
  kinds: Option[];
  visibilities: Option[];
  values?: CalendarEntryValues;
}) {
  const [state, formAction] = useActionState(action, idleState);
  const id = (name: string) => `${idPrefix}-cal-${name}`;

  return (
    <form action={formAction} className="space-y-3">
      <FormMessage state={state} />

      <Field label="Titel" htmlFor={id('title')} required>
        <input id={id('title')} name="title" required defaultValue={values?.title ?? ''} placeholder="Vorstandssitzung" />
        <FieldError state={state} name="title" />
      </Field>

      <Field label="Beginn" htmlFor={id('startAt')} required>
        <input
          id={id('startAt')}
          name="startAt"
          type="datetime-local"
          required
          defaultValue={values?.startAt ?? ''}
        />
      </Field>

      <Field label="Ende" htmlFor={id('endAt')} required>
        <input id={id('endAt')} name="endAt" type="datetime-local" required defaultValue={values?.endAt ?? ''} />
        <FieldError state={state} name="endAt" />
      </Field>

      <div className="flex items-center gap-2">
        <input id={id('allDay')} name="allDay" type="checkbox" defaultChecked={values?.allDay ?? false} />
        <label htmlFor={id('allDay')} className="font-normal">
          Ganztägig
        </label>
      </div>

      <Field label="Art" htmlFor={id('kind')}>
        <select id={id('kind')} name="kind" defaultValue={values?.kind ?? 'MEETING'}>
          {kinds.map((option) => (
            <option key={option.value} value={option.value}>
              {option.title}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Sichtbarkeit" htmlFor={id('visibility')}>
        <select id={id('visibility')} name="visibility" defaultValue={values?.visibility ?? 'COMMUNITY'}>
          {visibilities.map((option) => (
            <option key={option.value} value={option.value}>
              {option.title}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Ort" htmlFor={id('location')}>
        <input id={id('location')} name="location" defaultValue={values?.location ?? ''} />
      </Field>

      <Field label="Beschreibung" htmlFor={id('description')}>
        <textarea id={id('description')} name="description" rows={2} defaultValue={values?.description ?? ''} />
      </Field>

      <Field
        label="Wiederholung"
        htmlFor={id('recurrence')}
        hint="Regel nach iCalendar, zum Beispiel FREQ=MONTHLY;BYDAY=1MO"
      >
        <input id={id('recurrence')} name="recurrence" defaultValue={values?.recurrence ?? ''} />
      </Field>

      <SubmitButton pendingLabel="Wird gespeichert">{submitLabel}</SubmitButton>
    </form>
  );
}

export function EntryActions({
  entry,
  saveAction,
  deleteAction,
  kinds,
  visibilities,
}: {
  entry: CalendarEntryValues & {
    id: string;
    rangeLabel: string;
    kindLabel: string;
    visibilityLabel: string;
  };
  saveAction: FormAction;
  deleteAction: () => Promise<void>;
  kinds: Option[];
  visibilities: Option[];
}) {
  const [editing, setEditing] = useState(false);

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800">{entry.title}</p>
          <p className="text-xs text-slate-500">
            {entry.rangeLabel}
            {entry.location ? ` · ${entry.location}` : ''}
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            <Badge>{entry.kindLabel}</Badge>
            <Badge tone="info">{entry.visibilityLabel}</Badge>
            {entry.recurrence ? <Badge tone="brand">Wiederkehrend</Badge> : null}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setEditing((value) => !value)}>
          {editing ? 'Schließen' : 'Bearbeiten'}
        </Button>
      </div>

      {editing ? (
        <div className="mt-3 space-y-3 rounded-lg bg-slate-50 p-3">
          <CalendarEntryForm
            action={saveAction}
            idPrefix={entry.id}
            submitLabel="Speichern"
            kinds={kinds}
            visibilities={visibilities}
            values={entry}
          />
          <form action={deleteAction} className="border-t border-slate-200 pt-2">
            <SubmitButton variant="danger" size="sm" pendingLabel="Wird gelöscht">
              Termin löschen
            </SubmitButton>
          </form>
        </div>
      ) : null}
    </>
  );
}
