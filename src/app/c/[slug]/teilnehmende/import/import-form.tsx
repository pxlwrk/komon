'use client';

import { useActionState } from 'react';

import { FormMessage, SubmitButton } from '@/components/form';
import { Field, LinkButton } from '@/components/ui';
import { idleState } from '@/lib/action-state';

import { importMembersAction } from '../actions';

export function ImportForm({ slug }: { slug: string }) {
  const action = importMembersAction.bind(null, slug);
  const [state, formAction] = useActionState(action, idleState);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />

      <Field label="CSV-Datei" htmlFor="file" required>
        <input id="file" name="file" type="file" accept=".csv,text/csv,text/plain" required className="text-sm" />
      </Field>

      <div className="flex flex-wrap items-center gap-2">
        <SubmitButton pendingLabel="Import läuft">Import starten</SubmitButton>
        <LinkButton href={`/c/${slug}/teilnehmende`} variant="secondary">
          Zurück zur Liste
        </LinkButton>
      </div>
    </form>
  );
}
