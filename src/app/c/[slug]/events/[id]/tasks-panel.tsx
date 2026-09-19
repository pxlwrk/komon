'use client';

import { useActionState, useState } from 'react';

import { FormMessage, SubmitButton } from '@/components/form';
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Field } from '@/components/ui';
import { idleState, type ActionState } from '@/lib/action-state';
import {
  EVENT_TASK_PHASE,
  TASK_STATUS,
  eventTaskPhaseValues,
  label,
  taskStatusValues,
} from '@/lib/enums';

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;
type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

export type TaskView = {
  id: string;
  title: string;
  description: string | null;
  phase: string;
  status: string;
  statusTone: BadgeTone;
  dueAt: string;
  dueLabel: string | null;
  assigneeId: string;
  assigneeName: string | null;
  saveAction: FormAction;
  toggleAction: () => Promise<void>;
  deleteAction: () => Promise<void>;
};

export function TasksPanel({
  tasks,
  people,
  canManage,
  createAction,
}: {
  tasks: TaskView[];
  people: { id: string; name: string }[];
  canManage: boolean;
  createAction: FormAction;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {eventTaskPhaseValues.map((phase) => {
          const phaseTasks = tasks.filter((task) => task.phase === phase);
          const open = phaseTasks.filter((task) => task.status !== 'DONE').length;

          return (
            <Card key={phase}>
              <CardHeader
                title={EVENT_TASK_PHASE[phase]}
                description={`${phaseTasks.length} Aufgaben, davon ${open} offen`}
              />
              <CardBody className={phaseTasks.length === 0 ? 'p-0' : undefined}>
                {phaseTasks.length === 0 ? (
                  <EmptyState title="Keine Aufgaben in diesem Abschnitt" />
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {phaseTasks.map((task) => (
                      <TaskRow key={task.id} task={task} people={people} canManage={canManage} />
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          );
        })}
      </div>

      {canManage ? (
        <Card className="h-fit">
          <CardHeader
            title="Neue Aufgabe"
            action={
              <Button variant="ghost" size="sm" onClick={() => setAdding((value) => !value)}>
                {adding ? 'Schließen' : 'Öffnen'}
              </Button>
            }
          />
          {adding ? (
            <CardBody>
              <TaskForm action={createAction} idPrefix="neu" people={people} submitLabel="Aufgabe anlegen" />
            </CardBody>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}

function TaskRow({
  task,
  people,
  canManage,
}: {
  task: TaskView;
  people: { id: string; name: string }[];
  canManage: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const done = task.status === 'DONE';

  return (
    <li className="py-2.5 first:pt-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          {canManage ? (
            <form action={task.toggleAction} className="pt-0.5">
              <button
                type="submit"
                aria-label={done ? 'Als offen markieren' : 'Als erledigt markieren'}
                className={
                  done
                    ? 'flex h-4 w-4 items-center justify-center rounded border border-emerald-500 bg-emerald-500 text-[10px] text-white'
                    : 'h-4 w-4 rounded border border-slate-300 bg-white hover:border-brand-500'
                }
              >
                {done ? '✓' : ''}
              </button>
            </form>
          ) : null}

          <div className="min-w-0">
            <p className={done ? 'text-sm text-slate-400 line-through' : 'text-sm font-medium text-slate-800'}>
              {task.title}
            </p>
            <p className="text-xs text-slate-500">
              {[task.assigneeName ?? 'Ohne Zuständigkeit', task.dueLabel ? `fällig ${task.dueLabel}` : null]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {task.description ? <p className="mt-1 prose-note">{task.description}</p> : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Badge tone={task.statusTone}>{label(TASK_STATUS, task.status)}</Badge>
          {canManage ? (
            <Button variant="ghost" size="sm" onClick={() => setEditing((value) => !value)}>
              {editing ? 'Schließen' : 'Bearbeiten'}
            </Button>
          ) : null}
        </div>
      </div>

      {editing && canManage ? (
        <div className="mt-3 space-y-3 rounded-lg bg-slate-50 p-3">
          <TaskForm
            action={task.saveAction}
            idPrefix={task.id}
            people={people}
            submitLabel="Speichern"
            values={task}
          />
          <form action={task.deleteAction} className="border-t border-slate-200 pt-2">
            <SubmitButton variant="danger" size="sm" pendingLabel="Wird entfernt">
              Aufgabe entfernen
            </SubmitButton>
          </form>
        </div>
      ) : null}
    </li>
  );
}

function TaskForm({
  action,
  idPrefix,
  people,
  submitLabel,
  values,
}: {
  action: FormAction;
  idPrefix: string;
  people: { id: string; name: string }[];
  submitLabel: string;
  values?: Partial<TaskView>;
}) {
  const [state, formAction] = useActionState(action, idleState);
  const id = (name: string) => `${idPrefix}-task-${name}`;

  return (
    <form action={formAction} className="space-y-3">
      <FormMessage state={state} />

      <Field label="Titel" htmlFor={id('title')} required>
        <input id={id('title')} name="title" required defaultValue={values?.title ?? ''} />
      </Field>

      <Field label="Beschreibung" htmlFor={id('description')}>
        <textarea id={id('description')} name="description" rows={2} defaultValue={values?.description ?? ''} />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Abschnitt" htmlFor={id('phase')}>
          <select id={id('phase')} name="phase" defaultValue={values?.phase ?? 'PLANNING'}>
            {eventTaskPhaseValues.map((value) => (
              <option key={value} value={value}>
                {EVENT_TASK_PHASE[value]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Status" htmlFor={id('status')}>
          <select id={id('status')} name="status" defaultValue={values?.status ?? 'OPEN'}>
            {taskStatusValues.map((value) => (
              <option key={value} value={value}>
                {TASK_STATUS[value]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Zuständig" htmlFor={id('assigneeId')}>
          <select id={id('assigneeId')} name="assigneeId" defaultValue={values?.assigneeId ?? ''}>
            <option value="">Nicht festgelegt</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Fällig am" htmlFor={id('dueAt')}>
          <input id={id('dueAt')} name="dueAt" type="datetime-local" defaultValue={values?.dueAt ?? ''} />
        </Field>
      </div>

      <SubmitButton variant="secondary" size="sm" pendingLabel="Wird gespeichert">
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
