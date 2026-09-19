'use client';

import { useActionState } from 'react';

import { FieldError, FormMessage, SubmitButton } from '@/components/form';
import { Badge, Field } from '@/components/ui';
import { idleState, type ActionState } from '@/lib/action-state';

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function ProfileForm({
  action,
  timezones,
  values,
}: {
  action: FormAction;
  timezones: string[];
  values: {
    firstName: string;
    lastName: string;
    displayName: string | null;
    pronouns: string | null;
    phone: string | null;
    mobile: string | null;
    timezone: string;
    email: string;
  };
}) {
  const [state, formAction] = useActionState(action, idleState);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />

      <Field label="E-Mail-Adresse" htmlFor="account-email" hint="Änderungen nimmt die Verwaltung Ihrer Community vor.">
        <input id="account-email" value={values.email} readOnly disabled />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Vorname" htmlFor="firstName" required>
          <input id="firstName" name="firstName" required defaultValue={values.firstName} />
          <FieldError state={state} name="firstName" />
        </Field>

        <Field label="Nachname" htmlFor="lastName" required>
          <input id="lastName" name="lastName" required defaultValue={values.lastName} />
          <FieldError state={state} name="lastName" />
        </Field>

        <Field label="Anzeigename" htmlFor="displayName">
          <input id="displayName" name="displayName" defaultValue={values.displayName ?? ''} />
        </Field>

        <Field label="Pronomen" htmlFor="pronouns">
          <input id="pronouns" name="pronouns" defaultValue={values.pronouns ?? ''} placeholder="sie/ihr" />
        </Field>

        <Field label="Telefon" htmlFor="phone">
          <input id="phone" name="phone" type="tel" defaultValue={values.phone ?? ''} />
        </Field>

        <Field label="Mobil" htmlFor="mobile">
          <input id="mobile" name="mobile" type="tel" defaultValue={values.mobile ?? ''} />
        </Field>

        <Field label="Zeitzone" htmlFor="timezone">
          <select id="timezone" name="timezone" defaultValue={values.timezone}>
            {timezones.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <SubmitButton pendingLabel="Wird gespeichert">Angaben speichern</SubmitButton>
    </form>
  );
}

export function PasswordForm({ action }: { action: FormAction }) {
  const [state, formAction] = useActionState(action, idleState);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />

      <Field label="Bisheriges Passwort" htmlFor="current" required>
        <input id="current" name="current" type="password" required autoComplete="current-password" />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Neues Passwort" htmlFor="next" required hint="Mindestens zehn Zeichen.">
          <input id="next" name="next" type="password" required minLength={10} autoComplete="new-password" />
        </Field>

        <Field label="Neues Passwort wiederholen" htmlFor="repeat" required>
          <input id="repeat" name="repeat" type="password" required minLength={10} autoComplete="new-password" />
        </Field>
      </div>

      <SubmitButton pendingLabel="Wird geändert">Passwort ändern</SubmitButton>
    </form>
  );
}

export function SessionRow({
  session,
  endAction,
}: {
  session: {
    id: string;
    isCurrent: boolean;
    createdAt: string;
    expiresAt: string;
    userAgent: string | null;
    ipAddress: string | null;
  };
  endAction: () => Promise<void>;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm text-slate-800">
          Angemeldet seit {session.createdAt}
          {session.isCurrent ? <Badge tone="success">Diese Sitzung</Badge> : null}
        </p>
        <p className="truncate text-xs text-slate-500">
          {session.userAgent ?? 'Unbekanntes Gerät'}
          {session.ipAddress ? ` · ${session.ipAddress}` : ''}
        </p>
        <p className="text-xs text-slate-500">Gültig bis {session.expiresAt}</p>
      </div>

      {!session.isCurrent ? (
        <form action={endAction}>
          <SubmitButton variant="secondary" size="sm" pendingLabel="Wird beendet">
            Beenden
          </SubmitButton>
        </form>
      ) : null}
    </div>
  );
}
