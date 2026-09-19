'use client';

import { useActionState } from 'react';

import { FieldError, FormMessage, SubmitButton } from '@/components/form';
import { Field } from '@/components/ui';
import { idleState } from '@/lib/action-state';

import { createCommunityAction } from './actions';

export function CreateCommunityForm() {
  const [state, formAction] = useActionState(createCommunityAction, idleState);

  return (
    <form action={formAction} className="space-y-4">
      <h2 className="text-base font-semibold text-slate-900">Neue Community anlegen</h2>
      <FormMessage state={state} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="name" required>
          <input id="name" name="name" required placeholder="Nachbarschaftsinitiative Nordstadt" />
          <FieldError state={state} name="name" />
        </Field>

        <Field label="Kurzadresse" htmlFor="slug" hint="Teil der Internetadresse. Wird sonst aus dem Namen gebildet.">
          <input id="slug" name="slug" placeholder="nordstadt" />
          <FieldError state={state} name="slug" />
        </Field>
      </div>

      <Field label="Beschreibung" htmlFor="description">
        <textarea id="description" name="description" rows={3} placeholder="Worum geht es in dieser Community?" />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Domain für Gruppenmailadressen" htmlFor="mailDomain" hint="Beispiel: listen.example.org">
          <input id="mailDomain" name="mailDomain" placeholder="listen.example.org" />
        </Field>

        <Field label="Absenderadresse" htmlFor="senderEmail" hint="Erscheint als Absender ausgehender Nachrichten.">
          <input id="senderEmail" name="senderEmail" type="email" placeholder="info@example.org" />
        </Field>
      </div>

      <div className="flex items-center gap-2">
        <SubmitButton pendingLabel="Wird angelegt">Community anlegen</SubmitButton>
      </div>
    </form>
  );
}
