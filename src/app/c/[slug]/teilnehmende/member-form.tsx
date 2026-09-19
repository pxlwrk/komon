'use client';

import { useActionState } from 'react';

import { FieldError, FormMessage, SubmitButton } from '@/components/form';
import { Card, CardBody, CardHeader, Field, LinkButton } from '@/components/ui';
import { idleState, type ActionState } from '@/lib/action-state';
import type { CustomFieldDefinitionView, MemberFormValues } from './member-values';
import {
  MAIL_PREFERENCE,
  MEMBERSHIP_STATUS,
  PERSON_STATUS,
  SALUTATION,
  mailPreferenceValues,
  membershipStatusValues,
  personStatusValues,
  salutationValues,
} from '@/lib/enums';

export function MemberForm({
  action,
  values,
  customFields,
  cancelHref,
  submitLabel,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  values: MemberFormValues;
  customFields: CustomFieldDefinitionView[];
  cancelHref: string;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, idleState);

  return (
    <form action={formAction} className="space-y-6">
      <FormMessage state={state} />

      <Card>
        <CardHeader title="Person" description="Angaben zur Person, die in allen Communities gelten." />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Anrede" htmlFor="salutation">
            <select id="salutation" name="salutation" defaultValue={values.salutation ?? ''}>
              <option value="">Ohne Angabe</option>
              {salutationValues.map((value) => (
                <option key={value} value={value}>
                  {SALUTATION[value]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Titel" htmlFor="title">
            <input id="title" name="title" defaultValue={values.title ?? ''} placeholder="Dr." />
          </Field>

          <Field label="Vorname" htmlFor="firstName" required>
            <input id="firstName" name="firstName" required defaultValue={values.firstName} />
            <FieldError state={state} name="firstName" />
          </Field>

          <Field label="Nachname" htmlFor="lastName" required>
            <input id="lastName" name="lastName" required defaultValue={values.lastName} />
            <FieldError state={state} name="lastName" />
          </Field>

          <Field label="Anzeigename" htmlFor="displayName" hint="Wird bevorzugt angezeigt, wenn gesetzt.">
            <input id="displayName" name="displayName" defaultValue={values.displayName ?? ''} />
          </Field>

          <Field label="Pronomen" htmlFor="pronouns">
            <input id="pronouns" name="pronouns" defaultValue={values.pronouns ?? ''} placeholder="sie/ihr" />
          </Field>

          <Field label="E-Mail-Adresse" htmlFor="primaryEmail" required>
            <input
              id="primaryEmail"
              name="primaryEmail"
              type="email"
              required
              defaultValue={values.primaryEmail}
            />
            <FieldError state={state} name="primaryEmail" />
          </Field>

          <Field label="Geburtsdatum" htmlFor="birthDate">
            <input id="birthDate" name="birthDate" type="date" defaultValue={values.birthDate ?? ''} />
          </Field>

          <Field label="Telefon" htmlFor="phone">
            <input id="phone" name="phone" type="tel" defaultValue={values.phone ?? ''} />
          </Field>

          <Field label="Mobil" htmlFor="mobile">
            <input id="mobile" name="mobile" type="tel" defaultValue={values.mobile ?? ''} />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Anschrift" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Straße und Hausnummer" htmlFor="street" className="sm:col-span-2">
            <input id="street" name="street" defaultValue={values.street ?? ''} />
          </Field>

          <Field label="Postleitzahl" htmlFor="postalCode">
            <input id="postalCode" name="postalCode" defaultValue={values.postalCode ?? ''} />
          </Field>

          <Field label="Ort" htmlFor="city">
            <input id="city" name="city" defaultValue={values.city ?? ''} />
          </Field>

          <Field label="Region" htmlFor="region">
            <input id="region" name="region" defaultValue={values.region ?? ''} />
          </Field>

          <Field label="Land" htmlFor="country">
            <input id="country" name="country" defaultValue={values.country ?? ''} />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Beruf und Verweise" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Organisation" htmlFor="organization">
            <input id="organization" name="organization" defaultValue={values.organization ?? ''} />
          </Field>

          <Field label="Funktion" htmlFor="jobTitle">
            <input id="jobTitle" name="jobTitle" defaultValue={values.jobTitle ?? ''} />
          </Field>

          <Field label="Internetseite" htmlFor="website" className="sm:col-span-2">
            <input id="website" name="website" type="url" defaultValue={values.website ?? ''} placeholder="https://" />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Mitgliedschaft"
          description="Diese Angaben gelten nur innerhalb dieser Community."
        />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Mitgliedsnummer" htmlFor="memberNumber">
            <input id="memberNumber" name="memberNumber" defaultValue={values.memberNumber ?? ''} />
          </Field>

          <Field label="Funktion in der Community" htmlFor="position">
            <input id="position" name="position" defaultValue={values.position ?? ''} placeholder="Kassenwart" />
          </Field>

          <Field label="Status der Mitgliedschaft" htmlFor="membershipStatus">
            <select id="membershipStatus" name="membershipStatus" defaultValue={values.membershipStatus}>
              {membershipStatusValues.map((value) => (
                <option key={value} value={value}>
                  {MEMBERSHIP_STATUS[value]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Status der Person" htmlFor="personStatus">
            <select id="personStatus" name="personStatus" defaultValue={values.personStatus}>
              {personStatusValues.map((value) => (
                <option key={value} value={value}>
                  {PERSON_STATUS[value]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Zustellung von Rundmails" htmlFor="mailPreference">
            <select id="mailPreference" name="mailPreference" defaultValue={values.mailPreference}>
              {mailPreferenceValues.map((value) => (
                <option key={value} value={value}>
                  {MAIL_PREFERENCE[value]}
                </option>
              ))}
            </select>
          </Field>

          <div className="flex items-center gap-2 pt-6">
            <input
              id="allowBulkEmail"
              name="allowBulkEmail"
              type="checkbox"
              defaultChecked={values.allowBulkEmail}
            />
            <label htmlFor="allowBulkEmail" className="font-normal">
              Einverständnis für Rundschreiben liegt vor
            </label>
          </div>

          <Field label="Interne Notizen" htmlFor="notes" className="sm:col-span-2">
            <textarea id="notes" name="notes" rows={3} defaultValue={values.notes ?? ''} />
          </Field>
        </CardBody>
      </Card>

      {customFields.length > 0 ? (
        <Card>
          <CardHeader title="Weitere Angaben" description="Felder, die diese Community selbst festgelegt hat." />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            {customFields.map((definition) => (
              <CustomFieldInput
                key={definition.id}
                definition={definition}
                value={values.customValues[definition.key] ?? null}
              />
            ))}
          </CardBody>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <SubmitButton pendingLabel="Wird gespeichert">{submitLabel}</SubmitButton>
        <LinkButton href={cancelHref} variant="secondary">
          Abbrechen
        </LinkButton>
      </div>
    </form>
  );
}

function CustomFieldInput({
  definition,
  value,
}: {
  definition: CustomFieldDefinitionView;
  value: string | string[] | null;
}) {
  const name = `cf_${definition.key}`;
  const single = Array.isArray(value) ? '' : (value ?? '');
  const multiple = Array.isArray(value) ? value : [];

  if (definition.type === 'BOOLEAN') {
    return (
      <div className="flex items-center gap-2 pt-6">
        <input id={name} name={name} type="checkbox" defaultChecked={single === 'true'} />
        <label htmlFor={name} className="font-normal">
          {definition.label}
        </label>
      </div>
    );
  }

  return (
    <Field
      label={definition.label}
      htmlFor={name}
      hint={definition.description ?? undefined}
      required={definition.required}
      className={definition.type === 'LONGTEXT' || definition.type === 'MULTISELECT' ? 'sm:col-span-2' : undefined}
    >
      {definition.type === 'LONGTEXT' ? (
        <textarea id={name} name={name} rows={3} defaultValue={single} required={definition.required} />
      ) : definition.type === 'SELECT' ? (
        <select id={name} name={name} defaultValue={single} required={definition.required}>
          <option value="">Ohne Angabe</option>
          {definition.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : definition.type === 'MULTISELECT' ? (
        <div className="flex flex-wrap gap-3 rounded-lg border border-slate-300 bg-white px-3 py-2">
          {definition.options.map((option) => (
            <label key={option} className="flex items-center gap-1.5 font-normal">
              <input type="checkbox" name={name} value={option} defaultChecked={multiple.includes(option)} />
              <span className="text-sm">{option}</span>
            </label>
          ))}
        </div>
      ) : (
        <input
          id={name}
          name={name}
          type={
            definition.type === 'NUMBER'
              ? 'number'
              : definition.type === 'DATE'
                ? 'date'
                : definition.type === 'EMAIL'
                  ? 'email'
                  : definition.type === 'PHONE'
                    ? 'tel'
                    : definition.type === 'URL'
                      ? 'url'
                      : 'text'
          }
          defaultValue={single}
          required={definition.required}
        />
      )}
    </Field>
  );
}
