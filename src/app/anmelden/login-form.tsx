'use client';

import { useActionState } from 'react';

import { FormMessage, SubmitButton } from '@/components/form';
import { Field } from '@/components/ui';
import { idleState } from '@/lib/action-state';

import { loginAction } from './actions';

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const [state, formAction] = useActionState(loginAction, idleState);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />

      <Field label="E-Mail-Adresse" htmlFor="email" required>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          placeholder="name@example.org"
        />
      </Field>

      <Field label="Passwort" htmlFor="password" required>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>

      {redirectTo ? <input type="hidden" name="redirectTo" value={redirectTo} /> : null}

      <SubmitButton className="w-full" pendingLabel="Anmeldung läuft">
        Anmelden
      </SubmitButton>
    </form>
  );
}
