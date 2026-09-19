'use client';

import { useActionState, useState } from 'react';

import { FormMessage, SubmitButton } from '@/components/form';
import { Badge, Button, Card, CardBody, CardHeader, Field } from '@/components/ui';
import { idleState, type ActionState } from '@/lib/action-state';
import { EMAIL_ADDRESS_STATUS, label } from '@/lib/enums';

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function TagSection({
  action,
  tags,
  canEdit,
}: {
  action: FormAction;
  tags: string[];
  canEdit: boolean;
}) {
  const [state, formAction] = useActionState(action, idleState);

  return (
    <Card>
      <CardHeader title="Schlagworte" description="Mehrere Begriffe mit Komma trennen." />
      <CardBody className="space-y-3">
        {tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <Badge key={tag} tone="brand">
                {tag}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Noch keine Schlagworte vergeben.</p>
        )}

        {canEdit ? (
          <form action={formAction} className="space-y-2">
            <FormMessage state={state} />
            <input name="tags" defaultValue={tags.join(', ')} placeholder="Vorstand, Neuzugang" />
            <SubmitButton variant="secondary" size="sm" pendingLabel="Wird gespeichert">
              Schlagworte speichern
            </SubmitButton>
          </form>
        ) : null}
      </CardBody>
    </Card>
  );
}

export function EmailAddressSection({
  addAction,
  removeAction,
  addresses,
  canEdit,
}: {
  addAction: FormAction;
  removeAction: (addressId: string) => Promise<void>;
  addresses: { id: string; address: string; label: string | null; isPrimary: boolean; status: string }[];
  canEdit: boolean;
}) {
  const [state, formAction] = useActionState(addAction, idleState);
  const [showForm, setShowForm] = useState(false);

  return (
    <Card>
      <CardHeader
        title="E-Mail-Adressen"
        description="Mailinglisten erkennen Beiträge von allen hinterlegten Adressen."
        action={
          canEdit ? (
            <Button variant="ghost" size="sm" onClick={() => setShowForm((value) => !value)}>
              {showForm ? 'Schließen' : 'Hinzufügen'}
            </Button>
          ) : null
        }
      />
      <CardBody className="space-y-3">
        <ul className="space-y-2">
          {addresses.map((entry) => (
            <li key={entry.id} className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm text-slate-800">{entry.address}</p>
                <p className="text-xs text-slate-500">
                  {entry.isPrimary ? 'Hauptadresse' : (entry.label ?? 'Weitere Adresse')}
                  {entry.status !== 'ACTIVE' ? ` · ${label(EMAIL_ADDRESS_STATUS, entry.status)}` : ''}
                </p>
              </div>
              {canEdit && !entry.isPrimary ? (
                <form action={removeAction.bind(null, entry.id)}>
                  <button
                    type="submit"
                    className="rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-red-50 hover:text-red-700"
                  >
                    Entfernen
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>

        {showForm && canEdit ? (
          <form action={formAction} className="space-y-2 border-t border-slate-100 pt-3">
            <FormMessage state={state} />
            <Field label="Weitere Adresse" htmlFor="address">
              <input id="address" name="address" type="email" required placeholder="zweitadresse@example.org" />
            </Field>
            <Field label="Bezeichnung" htmlFor="label">
              <input id="label" name="label" placeholder="Dienstlich" />
            </Field>
            <SubmitButton variant="secondary" size="sm" pendingLabel="Wird gespeichert">
              Adresse hinterlegen
            </SubmitButton>
          </form>
        ) : null}
      </CardBody>
    </Card>
  );
}

export function RoleSection({
  action,
  roles,
  selected,
}: {
  action: FormAction;
  roles: { id: string; name: string; description: string | null }[];
  selected: string[];
}) {
  const [state, formAction] = useActionState(action, idleState);

  return (
    <Card>
      <CardHeader title="Rollen" description="Die Rechte ergeben sich aus allen zugewiesenen Rollen." />
      <CardBody>
        <form action={formAction} className="space-y-3">
          <FormMessage state={state} />
          <div className="space-y-2">
            {roles.map((role) => (
              <label key={role.id} className="flex items-start gap-2 font-normal">
                <input
                  type="checkbox"
                  name="roleIds"
                  value={role.id}
                  defaultChecked={selected.includes(role.id)}
                  className="mt-0.5"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-slate-800">{role.name}</span>
                  {role.description ? (
                    <span className="block text-xs text-slate-500">{role.description}</span>
                  ) : null}
                </span>
              </label>
            ))}
          </div>
          <SubmitButton variant="secondary" size="sm" pendingLabel="Wird gespeichert">
            Rollen speichern
          </SubmitButton>
        </form>
      </CardBody>
    </Card>
  );
}

export function GroupSection({
  action,
  groups,
  selected,
}: {
  action: FormAction;
  groups: { id: string; name: string }[];
  selected: string[];
}) {
  const [state, formAction] = useActionState(action, idleState);

  return (
    <Card>
      <CardHeader title="Gruppen" />
      <CardBody>
        {groups.length === 0 ? (
          <p className="text-sm text-slate-500">Diese Community hat noch keine Gruppen.</p>
        ) : (
          <form action={formAction} className="space-y-3">
            <FormMessage state={state} />
            <div className="space-y-1.5">
              {groups.map((group) => (
                <label key={group.id} className="flex items-center gap-2 font-normal">
                  <input
                    type="checkbox"
                    name="groupIds"
                    value={group.id}
                    defaultChecked={selected.includes(group.id)}
                  />
                  <span className="text-sm text-slate-800">{group.name}</span>
                </label>
              ))}
            </div>
            <SubmitButton variant="secondary" size="sm" pendingLabel="Wird gespeichert">
              Zuordnung speichern
            </SubmitButton>
          </form>
        )}
      </CardBody>
    </Card>
  );
}

export function RemoveMemberButton({ action, name }: { action: () => Promise<void>; name: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
        Aus Community entfernen
      </Button>
    );
  }

  return (
    <form action={action} className="flex items-center gap-2">
      <span className="text-sm text-slate-600">{name} wirklich entfernen?</span>
      <SubmitButton variant="danger" size="sm" pendingLabel="Wird entfernt">
        Ja, entfernen
      </SubmitButton>
      <Button variant="secondary" size="sm" type="button" onClick={() => setConfirming(false)}>
        Abbrechen
      </Button>
    </form>
  );
}
