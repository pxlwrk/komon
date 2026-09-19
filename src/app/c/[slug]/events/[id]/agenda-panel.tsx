'use client';

import { useActionState, useState } from 'react';

import { FormMessage, SubmitButton } from '@/components/form';
import { Button, Card, CardBody, CardHeader, EmptyState, Field } from '@/components/ui';
import { idleState, type ActionState } from '@/lib/action-state';

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

type AgendaItem = {
  id: string;
  title: string;
  speaker: string | null;
  notes: string | null;
  startAt: string;
  startLabel: string | null;
  durationMinutes: number | null;
  position: number;
  saveAction: FormAction;
  deleteAction: () => Promise<void>;
};

export function AgendaPanel({
  items,
  canManage,
  createAction,
}: {
  items: AgendaItem[];
  canManage: boolean;
  createAction: FormAction;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Card>
          <CardHeader
            title="Programm"
            description="Die einzelnen Punkte des Ablaufs."
            action={
              canManage ? (
                <Button variant="secondary" size="sm" onClick={() => setAdding((value) => !value)}>
                  {adding ? 'Schließen' : 'Punkt hinzufügen'}
                </Button>
              ) : null
            }
          />
          <CardBody className={items.length === 0 && !adding ? 'p-0' : undefined}>
            {adding && canManage ? (
              <div className="mb-4">
                <AgendaForm action={createAction} idPrefix="neu" submitLabel="Punkt hinzufügen" />
              </div>
            ) : null}

            {items.length === 0 ? (
              <EmptyState title="Noch kein Programm" description="Gliedern Sie den Ablauf in einzelne Punkte." />
            ) : (
              <ol className="divide-y divide-slate-100">
                {items.map((item) => (
                  <AgendaRow key={item.id} item={item} canManage={canManage} />
                ))}
              </ol>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function AgendaRow({ item, canManage }: { item: AgendaItem; canManage: boolean }) {
  const [editing, setEditing] = useState(false);

  return (
    <li className="py-3 first:pt-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900">{item.title}</p>
          <p className="text-xs text-slate-500">
            {[
              item.startLabel,
              item.durationMinutes ? `${item.durationMinutes} Minuten` : null,
              item.speaker,
            ]
              .filter(Boolean)
              .join(' · ') || 'Ohne Zeitangabe'}
          </p>
          {item.notes ? <p className="mt-1 prose-note">{item.notes}</p> : null}
        </div>
        {canManage ? (
          <Button variant="ghost" size="sm" onClick={() => setEditing((value) => !value)}>
            {editing ? 'Schließen' : 'Bearbeiten'}
          </Button>
        ) : null}
      </div>

      {editing && canManage ? (
        <div className="mt-3 space-y-3 rounded-lg bg-slate-50 p-3">
          <AgendaForm action={item.saveAction} idPrefix={item.id} submitLabel="Speichern" values={item} />
          <form action={item.deleteAction} className="border-t border-slate-200 pt-2">
            <SubmitButton variant="danger" size="sm" pendingLabel="Wird entfernt">
              Punkt entfernen
            </SubmitButton>
          </form>
        </div>
      ) : null}
    </li>
  );
}

function AgendaForm({
  action,
  idPrefix,
  submitLabel,
  values,
}: {
  action: FormAction;
  idPrefix: string;
  submitLabel: string;
  values?: Partial<AgendaItem>;
}) {
  const [state, formAction] = useActionState(action, idleState);
  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <form action={formAction} className="space-y-3">
      <FormMessage state={state} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Titel" htmlFor={id('title')} required className="sm:col-span-2">
          <input id={id('title')} name="title" required defaultValue={values?.title ?? ''} />
        </Field>

        <Field label="Beginn" htmlFor={id('startAt')}>
          <input id={id('startAt')} name="startAt" type="datetime-local" defaultValue={values?.startAt ?? ''} />
        </Field>

        <Field label="Dauer in Minuten" htmlFor={id('durationMinutes')}>
          <input
            id={id('durationMinutes')}
            name="durationMinutes"
            type="number"
            min="0"
            defaultValue={values?.durationMinutes ?? ''}
          />
        </Field>

        <Field label="Vortragende Person" htmlFor={id('speaker')}>
          <input id={id('speaker')} name="speaker" defaultValue={values?.speaker ?? ''} />
        </Field>

        <Field label="Reihenfolge" htmlFor={id('position')}>
          <input id={id('position')} name="position" type="number" defaultValue={values?.position ?? 0} />
        </Field>

        <Field label="Notizen" htmlFor={id('notes')} className="sm:col-span-2">
          <textarea id={id('notes')} name="notes" rows={2} defaultValue={values?.notes ?? ''} />
        </Field>
      </div>

      <SubmitButton variant="secondary" size="sm" pendingLabel="Wird gespeichert">
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
