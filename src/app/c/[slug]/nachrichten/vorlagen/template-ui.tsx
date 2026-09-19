'use client';

import { useActionState, useState } from 'react';

import { FormMessage, SubmitButton } from '@/components/form';
import { Badge, Button, Card, CardBody, CardHeader, Field, LinkButton } from '@/components/ui';
import { idleState, type ActionState } from '@/lib/action-state';

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function TemplateForm({
  action,
  submitLabel,
  idPrefix,
  values,
}: {
  action: FormAction;
  submitLabel: string;
  /** Sorgt fuer eindeutige Feld-IDs, wenn mehrere Formulare auf einer Seite stehen. */
  idPrefix: string;
  values?: { name: string; description: string | null; subject: string; bodyText: string };
}) {
  const [state, formAction] = useActionState(action, idleState);

  return (
    <form action={formAction} className="space-y-3">
      <FormMessage state={state} />

      <Field label="Name" htmlFor={`name-${idPrefix}`} required>
        <input id={`name-${idPrefix}`} name="name" required defaultValue={values?.name ?? ''} placeholder="Begrüßung neuer Mitglieder" />
      </Field>

      <Field label="Beschreibung" htmlFor={`description-${idPrefix}`}>
        <input id={`description-${idPrefix}`} name="description" defaultValue={values?.description ?? ''} />
      </Field>

      <Field label="Betreff" htmlFor={`subject-${idPrefix}`} required>
        <input id={`subject-${idPrefix}`} name="subject" required defaultValue={values?.subject ?? ''} />
      </Field>

      <Field
        label="Text"
        htmlFor={`bodyText-${idPrefix}`}
        required
        hint="Platzhalter: {{vorname}}, {{name}}, {{email}}, {{antwort_link}}"
      >
        <textarea
          id={`bodyText-${idPrefix}`}
          name="bodyText"
          rows={8}
          required
          defaultValue={values?.bodyText ?? ''}
        />
      </Field>

      <SubmitButton pendingLabel="Wird gespeichert">{submitLabel}</SubmitButton>
    </form>
  );
}

export function TemplateCard({
  template,
  useHref,
  saveAction,
  deleteAction,
}: {
  template: {
    id: string;
    name: string;
    description: string | null;
    subject: string;
    bodyText: string;
    isSystem: boolean;
  };
  useHref: string;
  saveAction: FormAction;
  deleteAction: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            {template.name}
            {template.isSystem ? <Badge tone="info">System</Badge> : null}
          </span>
        }
        description={template.description ?? undefined}
        action={
          <div className="flex gap-1">
            <LinkButton href={useHref} variant="secondary" size="sm">
              Verwenden
            </LinkButton>
            <Button variant="ghost" size="sm" onClick={() => setEditing((value) => !value)}>
              {editing ? 'Schließen' : 'Bearbeiten'}
            </Button>
          </div>
        }
      />
      <CardBody className="space-y-3">
        {editing ? (
          <>
            <TemplateForm
              action={saveAction}
              submitLabel="Änderungen speichern"
              idPrefix={template.id}
              values={template}
            />
            {!template.isSystem ? (
              confirming ? (
                <form action={deleteAction} className="flex items-center gap-2 border-t border-slate-100 pt-3">
                  <span className="text-sm text-slate-600">Vorlage wirklich löschen?</span>
                  <SubmitButton variant="danger" size="sm" pendingLabel="Wird gelöscht">
                    Ja, löschen
                  </SubmitButton>
                  <Button variant="secondary" size="sm" type="button" onClick={() => setConfirming(false)}>
                    Abbrechen
                  </Button>
                </form>
              ) : (
                <div className="border-t border-slate-100 pt-3">
                  <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
                    Vorlage löschen
                  </Button>
                </div>
              )
            ) : null}
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-slate-800">{template.subject}</p>
            <p className="prose-note line-clamp-4">{template.bodyText}</p>
          </>
        )}
      </CardBody>
    </Card>
  );
}
