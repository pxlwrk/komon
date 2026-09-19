'use client';

import { useActionState } from 'react';

import { FieldError, FormMessage, SubmitButton } from '@/components/form';
import { Card, CardBody, CardHeader, Field, LinkButton } from '@/components/ui';
import { idleState, type ActionState } from '@/lib/action-state';
import type { EventFormValues } from './event-values';
import {
  EVENT_STATUS,
  EVENT_VISIBILITY,
  eventStatusValues,
  eventVisibilityValues,
} from '@/lib/enums';

export function EventForm({
  action,
  values,
  organizers,
  cancelHref,
  submitLabel,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  values: EventFormValues;
  organizers: { id: string; name: string }[];
  cancelHref: string;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, idleState);

  return (
    <form action={formAction} className="space-y-6">
      <FormMessage state={state} />

      <Card>
        <CardHeader title="Eckdaten" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Titel" htmlFor="title" required className="sm:col-span-2">
            <input id="title" name="title" required defaultValue={values.title} placeholder="Jahresversammlung 2026" />
            <FieldError state={state} name="title" />
          </Field>

          <Field label="Kurzbeschreibung" htmlFor="summary" className="sm:col-span-2" hint="Erscheint in der Einladung.">
            <input id="summary" name="summary" defaultValue={values.summary ?? ''} />
          </Field>

          <Field label="Beginn" htmlFor="startAt" required>
            <input id="startAt" name="startAt" type="datetime-local" required defaultValue={values.startAt} />
            <FieldError state={state} name="startAt" />
          </Field>

          <Field label="Ende" htmlFor="endAt" required>
            <input id="endAt" name="endAt" type="datetime-local" required defaultValue={values.endAt} />
            <FieldError state={state} name="endAt" />
          </Field>

          <div className="flex items-center gap-2">
            <input id="allDay" name="allDay" type="checkbox" defaultChecked={values.allDay} />
            <label htmlFor="allDay" className="font-normal">
              Ganztägig
            </label>
          </div>

          <Field label="Status" htmlFor="status">
            <select id="status" name="status" defaultValue={values.status}>
              {eventStatusValues.map((value) => (
                <option key={value} value={value}>
                  {EVENT_STATUS[value]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Beschreibung" htmlFor="description" className="sm:col-span-2">
            <textarea id="description" name="description" rows={6} defaultValue={values.description ?? ''} />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Ort" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Bezeichnung" htmlFor="locationName">
            <input id="locationName" name="locationName" defaultValue={values.locationName ?? ''} placeholder="Bürgerhaus" />
          </Field>

          <Field label="Anschrift" htmlFor="locationAddress">
            <input id="locationAddress" name="locationAddress" defaultValue={values.locationAddress ?? ''} />
          </Field>

          <Field label="Link zur Online-Teilnahme" htmlFor="onlineUrl" className="sm:col-span-2">
            <input id="onlineUrl" name="onlineUrl" type="url" defaultValue={values.onlineUrl ?? ''} placeholder="https://" />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Anmeldung" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Höchstzahl" htmlFor="capacity" hint="Leer lassen für unbegrenzt.">
            <input id="capacity" name="capacity" type="number" min="1" defaultValue={values.capacity} />
          </Field>

          <Field label="Anmeldeschluss" htmlFor="registrationClosesAt">
            <input
              id="registrationClosesAt"
              name="registrationClosesAt"
              type="datetime-local"
              defaultValue={values.registrationClosesAt}
            />
          </Field>

          <Field label="Sichtbarkeit" htmlFor="visibility">
            <select id="visibility" name="visibility" defaultValue={values.visibility}>
              {eventVisibilityValues.map((value) => (
                <option key={value} value={value}>
                  {EVENT_VISIBILITY[value]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Verantwortung" htmlFor="organizerId">
            <select id="organizerId" name="organizerId" defaultValue={values.organizerId}>
              <option value="">Nicht festgelegt</option>
              {organizers.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </Field>

          <div className="flex items-center gap-2">
            <input
              id="waitlistEnabled"
              name="waitlistEnabled"
              type="checkbox"
              defaultChecked={values.waitlistEnabled}
            />
            <label htmlFor="waitlistEnabled" className="font-normal">
              Warteliste führen, wenn die Höchstzahl erreicht ist
            </label>
          </div>

          <div className="flex items-center gap-2">
            <input id="allowGuests" name="allowGuests" type="checkbox" defaultChecked={values.allowGuests} />
            <label htmlFor="allowGuests" className="font-normal">
              Begleitpersonen sind willkommen
            </label>
          </div>

          <Field label="Geplantes Budget in Euro" htmlFor="plannedBudget">
            <input id="plannedBudget" name="plannedBudget" inputMode="decimal" defaultValue={values.plannedBudget} />
          </Field>
        </CardBody>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <SubmitButton pendingLabel="Wird gespeichert">{submitLabel}</SubmitButton>
        <LinkButton href={cancelHref} variant="secondary">
          Abbrechen
        </LinkButton>
      </div>
    </form>
  );
}
