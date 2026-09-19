'use client';

import { useActionState } from 'react';

import { FieldError, FormMessage, SubmitButton } from '@/components/form';
import { Card, CardBody, CardHeader, Field, LinkButton } from '@/components/ui';
import { idleState, type ActionState } from '@/lib/action-state';
import type { JournalFormValues } from './journal-values';
import {
  JOURNAL_CHANNEL,
  JOURNAL_STATUS,
  JOURNAL_TYPE,
  JOURNAL_VISIBILITY,
  journalChannelValues,
  journalStatusValues,
  journalTypeValues,
  journalVisibilityValues,
} from '@/lib/enums';

export function JournalForm({
  action,
  values,
  events,
  canPublish,
  cancelHref,
  submitLabel,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  values: JournalFormValues;
  events: { id: string; title: string }[];
  canPublish: boolean;
  cancelHref: string;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, idleState);

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <FormMessage state={state} />

        <Card>
          <CardHeader title="Inhalt" />
          <CardBody className="space-y-4">
            <Field label="Titel" htmlFor="title" required>
              <input id="title" name="title" required defaultValue={values.title} />
              <FieldError state={state} name="title" />
            </Field>

            <Field label="Kurzfassung" htmlFor="summary" hint="Ein bis zwei Sätze für Übersichten.">
              <textarea id="summary" name="summary" rows={2} defaultValue={values.summary ?? ''} />
            </Field>

            <Field label="Text" htmlFor="content">
              <textarea id="content" name="content" rows={20} defaultValue={values.content} />
            </Field>
          </CardBody>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader title="Einordnung" />
          <CardBody className="space-y-4">
            <Field label="Art" htmlFor="type">
              <select id="type" name="type" defaultValue={values.type}>
                {journalTypeValues.map((value) => (
                  <option key={value} value={value}>
                    {JOURNAL_TYPE[value]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Status" htmlFor="status">
              <select id="status" name="status" defaultValue={values.status}>
                {journalStatusValues
                  .filter((value) => canPublish || value !== 'PUBLISHED')
                  .map((value) => (
                    <option key={value} value={value}>
                      {JOURNAL_STATUS[value]}
                    </option>
                  ))}
              </select>
            </Field>

            <Field label="Kanal" htmlFor="channel">
              <select id="channel" name="channel" defaultValue={values.channel}>
                {journalChannelValues.map((value) => (
                  <option key={value} value={value}>
                    {JOURNAL_CHANNEL[value]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Sichtbarkeit" htmlFor="visibility">
              <select id="visibility" name="visibility" defaultValue={values.visibility}>
                {journalVisibilityValues.map((value) => (
                  <option key={value} value={value}>
                    {JOURNAL_VISIBILITY[value]}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="Geplant für"
              htmlFor="plannedAt"
              hint="Erscheint als Eintrag im Redaktionsplan und im Kalender."
            >
              <input id="plannedAt" name="plannedAt" type="datetime-local" defaultValue={values.plannedAt} />
            </Field>

            <Field label="Bezug zu einem Event" htmlFor="eventId">
              <select id="eventId" name="eventId" defaultValue={values.eventId}>
                <option value="">Ohne Bezug</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.title}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Schlagworte" htmlFor="tags" hint="Mehrere Begriffe mit Komma trennen.">
              <input id="tags" name="tags" defaultValue={values.tags} placeholder="Rückblick, Vorstand" />
            </Field>
          </CardBody>
        </Card>

        <div className="flex flex-wrap gap-2">
          <SubmitButton pendingLabel="Wird gespeichert">{submitLabel}</SubmitButton>
          <LinkButton href={cancelHref} variant="secondary">
            Abbrechen
          </LinkButton>
        </div>
      </div>
    </form>
  );
}
