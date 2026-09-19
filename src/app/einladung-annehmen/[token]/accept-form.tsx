'use client';

import { useActionState } from 'react';

import { FormMessage, SubmitButton } from '@/components/form';
import { Field } from '@/components/ui';
import { idleState, type ActionState } from '@/lib/action-state';

export function AcceptForm({
  action,
  email,
  firstName,
  lastName,
  roleName,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  email: string;
  firstName: string;
  lastName: string;
  roleName: string | null;
}) {
  const [state, formAction] = useActionState(action, idleState);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />

      <Field label="E-Mail-Adresse" htmlFor="email">
        <input id="email" value={email} readOnly disabled />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Vorname" htmlFor="firstName" required>
          <input id="firstName" name="firstName" required defaultValue={firstName} />
        </Field>

        <Field label="Nachname" htmlFor="lastName" required>
          <input id="lastName" name="lastName" required defaultValue={lastName} />
        </Field>
      </div>

      <Field label="Passwort" htmlFor="password" required hint="Mindestens zehn Zeichen.">
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
        />
      </Field>

      <Field label="Passwort wiederholen" htmlFor="passwordRepeat" required>
        <input
          id="passwordRepeat"
          name="passwordRepeat"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
        />
      </Field>

      {roleName ? <p className="hint">Sie erhalten die Rolle: {roleName}</p> : null}

      <SubmitButton className="w-full" pendingLabel="Wird eingerichtet">
        Zugang einrichten
      </SubmitButton>
    </form>
  );
}
