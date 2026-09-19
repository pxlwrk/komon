'use client';

import { useActionState, useState } from 'react';

import { FormMessage, SubmitButton } from '@/components/form';
import { Badge, Button, Card, CardBody, CardHeader, Field } from '@/components/ui';
import { idleState, type ActionState } from '@/lib/action-state';
import { EVENT_RESOURCE_KIND, eventResourceKindValues, label } from '@/lib/enums';

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function ResourcesPanel({
  resources,
  files,
  canManage,
  linkAction,
}: {
  resources: {
    id: string;
    kind: string;
    label: string | null;
    fileName: string;
    href: string;
    unlinkAction: () => Promise<void>;
  }[];
  files: { id: string; name: string }[];
  canManage: boolean;
  linkAction: FormAction;
}) {
  const [adding, setAdding] = useState(false);
  const [state, formAction] = useActionState(linkAction, idleState);

  return (
    <Card>
      <CardHeader
        title="Unterlagen"
        description="Dateien aus der Ablage, die zu diesem Event gehören."
        action={
          canManage && files.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => setAdding((value) => !value)}>
              {adding ? 'Schließen' : 'Verknüpfen'}
            </Button>
          ) : null
        }
      />
      <CardBody className="space-y-3">
        {resources.length === 0 ? (
          <p className="text-sm text-slate-500">Noch keine Unterlagen verknüpft.</p>
        ) : (
          <ul className="space-y-2">
            {resources.map((resource) => (
              <li key={resource.id} className="flex items-start justify-between gap-2">
                <a href={resource.href} className="min-w-0 hover:text-brand-700">
                  <span className="block truncate text-sm text-slate-800">
                    {resource.label ?? resource.fileName}
                  </span>
                  <span className="block truncate text-xs text-slate-500">{resource.fileName}</span>
                </a>
                <div className="flex shrink-0 items-center gap-1">
                  <Badge>{label(EVENT_RESOURCE_KIND, resource.kind)}</Badge>
                  {canManage ? (
                    <form action={resource.unlinkAction}>
                      <button
                        type="submit"
                        className="rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-red-50 hover:text-red-700"
                      >
                        Lösen
                      </button>
                    </form>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}

        {adding && canManage ? (
          <form action={formAction} className="space-y-3 border-t border-slate-100 pt-3">
            <FormMessage state={state} />

            <Field label="Datei" htmlFor="resource-file" required>
              <select id="resource-file" name="fileId" required defaultValue="">
                <option value="">Bitte wählen</option>
                {files.map((file) => (
                  <option key={file.id} value={file.id}>
                    {file.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Art" htmlFor="resource-kind">
              <select id="resource-kind" name="kind" defaultValue="OTHER">
                {eventResourceKindValues.map((value) => (
                  <option key={value} value={value}>
                    {EVENT_RESOURCE_KIND[value]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Bezeichnung" htmlFor="resource-label">
              <input id="resource-label" name="label" placeholder="Protokoll der Sitzung" />
            </Field>

            <SubmitButton variant="secondary" size="sm" pendingLabel="Wird verknüpft">
              Verknüpfen
            </SubmitButton>
          </form>
        ) : null}
      </CardBody>
    </Card>
  );
}
