'use client';

import { useActionState, useMemo, useState } from 'react';

import { FormMessage, SubmitButton } from '@/components/form';
import { Badge, Button, Card, CardBody, CardHeader, Field } from '@/components/ui';
import { idleState, type ActionState } from '@/lib/action-state';

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function CreateGroupForm({ action }: { action: FormAction }) {
  const [state, formAction] = useActionState(action, idleState);

  return (
    <form action={formAction} className="space-y-3">
      <FormMessage state={state} />
      <Field label="Name" htmlFor="name" required>
        <input id="name" name="name" required placeholder="Arbeitskreis Kultur" />
      </Field>
      <Field label="Beschreibung" htmlFor="description">
        <textarea id="description" name="description" rows={2} />
      </Field>
      <SubmitButton pendingLabel="Wird angelegt">Gruppe anlegen</SubmitButton>
    </form>
  );
}

export function GroupCard({
  group,
  candidates,
  canManage,
  updateAction,
  membersAction,
  deleteAction,
}: {
  group: {
    id: string;
    name: string;
    description: string | null;
    color: string | null;
    memberCount: number;
    memberIds: string[];
    lists: string[];
  };
  candidates: { id: string; name: string; email: string }[];
  canManage: boolean;
  updateAction: FormAction;
  membersAction: FormAction;
  deleteAction: () => Promise<void>;
}) {
  const [view, setView] = useState<'none' | 'edit' | 'members'>('none');

  return (
    <Card>
      <CardHeader
        title={group.name}
        description={group.description ?? undefined}
        action={
          canManage ? (
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setView(view === 'members' ? 'none' : 'members')}
              >
                Mitglieder
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setView(view === 'edit' ? 'none' : 'edit')}>
                Bearbeiten
              </Button>
            </div>
          ) : null
        }
      />
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="brand">
            {group.memberCount} {group.memberCount === 1 ? 'Person' : 'Personen'}
          </Badge>
          {group.lists.map((list) => (
            <Badge key={list} tone="info">
              Liste: {list}
            </Badge>
          ))}
        </div>

        {view === 'edit' && canManage ? (
          <EditGroupForm group={group} action={updateAction} deleteAction={deleteAction} />
        ) : null}

        {view === 'members' && canManage ? (
          <MemberPicker group={group} candidates={candidates} action={membersAction} />
        ) : null}
      </CardBody>
    </Card>
  );
}

function EditGroupForm({
  group,
  action,
  deleteAction,
}: {
  group: { name: string; description: string | null; color: string | null };
  action: FormAction;
  deleteAction: () => Promise<void>;
}) {
  const [state, formAction] = useActionState(action, idleState);
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="space-y-3 border-t border-slate-100 pt-4">
      <form action={formAction} className="space-y-3">
        <FormMessage state={state} />
        <Field label="Name" htmlFor={`name-${group.name}`} required>
          <input id={`name-${group.name}`} name="name" defaultValue={group.name} required />
        </Field>
        <Field label="Beschreibung" htmlFor={`description-${group.name}`}>
          <textarea id={`description-${group.name}`} name="description" rows={2} defaultValue={group.description ?? ''} />
        </Field>
        <SubmitButton variant="secondary" size="sm" pendingLabel="Wird gespeichert">
          Speichern
        </SubmitButton>
      </form>

      {confirming ? (
        <form action={deleteAction} className="flex items-center gap-2">
          <span className="text-sm text-slate-600">Gruppe wirklich löschen?</span>
          <SubmitButton variant="danger" size="sm" pendingLabel="Wird gelöscht">
            Ja, löschen
          </SubmitButton>
          <Button variant="secondary" size="sm" type="button" onClick={() => setConfirming(false)}>
            Abbrechen
          </Button>
        </form>
      ) : (
        <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
          Gruppe löschen
        </Button>
      )}
    </div>
  );
}

function MemberPicker({
  group,
  candidates,
  action,
}: {
  group: { memberIds: string[] };
  candidates: { id: string; name: string; email: string }[];
  action: FormAction;
}) {
  const [state, formAction] = useActionState(action, idleState);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return candidates;
    return candidates.filter(
      (entry) =>
        entry.name.toLowerCase().includes(needle) || entry.email.toLowerCase().includes(needle),
    );
  }, [candidates, search]);

  return (
    <form action={formAction} className="space-y-3 border-t border-slate-100 pt-4">
      <FormMessage state={state} />

      <input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Personen suchen"
      />

      <div className="scroll-area max-h-72 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
        {filtered.length === 0 ? (
          <p className="px-2 py-3 text-sm text-slate-500">Keine passenden Personen gefunden.</p>
        ) : (
          filtered.map((entry) => (
            <label key={entry.id} className="flex items-center gap-2 rounded px-2 py-1 font-normal hover:bg-slate-50">
              <input
                type="checkbox"
                name="membershipIds"
                value={entry.id}
                defaultChecked={group.memberIds.includes(entry.id)}
              />
              <span className="min-w-0">
                <span className="block truncate text-sm text-slate-800">{entry.name}</span>
                <span className="block truncate text-xs text-slate-500">{entry.email}</span>
              </span>
            </label>
          ))
        )}
      </div>

      <p className="hint">
        Personen, die durch die Suche ausgeblendet sind, behalten ihre Zuordnung nur, wenn sie
        angehakt bleiben. Leeren Sie die Suche vor dem Speichern.
      </p>

      <SubmitButton variant="secondary" size="sm" pendingLabel="Wird gespeichert">
        Zuordnung speichern
      </SubmitButton>
    </form>
  );
}
