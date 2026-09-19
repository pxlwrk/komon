'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';

import { FormMessage, SubmitButton } from '@/components/form';
import { Avatar, Badge, Button, Card, CardBody, CardHeader, Field } from '@/components/ui';
import { idleState, type ActionState } from '@/lib/action-state';

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

export type PermissionGroupView = {
  title: string;
  permissions: { key: string; title: string; available: boolean }[];
};

export function RoleForm({
  action,
  idPrefix,
  submitLabel,
  permissionGroups,
  values,
  locked = false,
}: {
  action: FormAction;
  idPrefix: string;
  submitLabel: string;
  permissionGroups: PermissionGroupView[];
  values?: { name: string; description: string | null; rank: number; permissions: string[] };
  /** Die Leitungsrolle behält alle Rechte, die Auswahl ist dann gesperrt. */
  locked?: boolean;
}) {
  const [state, formAction] = useActionState(action, idleState);
  const id = (name: string) => `${idPrefix}-role-${name}`;

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />

      <Field label="Name" htmlFor={id('name')} required>
        <input id={id('name')} name="name" required defaultValue={values?.name ?? ''} />
      </Field>

      <Field label="Beschreibung" htmlFor={id('description')}>
        <input id={id('description')} name="description" defaultValue={values?.description ?? ''} />
      </Field>

      <Field label="Rang" htmlFor={id('rank')} hint="Kleinere Zahlen stehen weiter oben.">
        <input id={id('rank')} name="rank" type="number" defaultValue={values?.rank ?? 80} />
      </Field>

      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-700">Berechtigungen</p>
        {locked ? (
          <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
            Diese Rolle behält immer alle Rechte.
          </p>
        ) : (
          permissionGroups.map((group) => (
            <fieldset key={group.title} className="rounded-lg border border-slate-200 p-3">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {group.title}
              </legend>
              <div className="space-y-1.5">
                {group.permissions.map((permission) => (
                  <label
                    key={permission.key}
                    className={
                      permission.available
                        ? 'flex items-center gap-2 font-normal'
                        : 'flex items-center gap-2 font-normal opacity-50'
                    }
                    title={permission.available ? undefined : 'Dieses Recht besitzen Sie selbst nicht.'}
                  >
                    <input
                      type="checkbox"
                      name="permissions"
                      value={permission.key}
                      defaultChecked={values?.permissions.includes(permission.key) ?? false}
                      disabled={!permission.available}
                    />
                    <span className="text-sm text-slate-700">{permission.title}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))
        )}
      </div>

      <SubmitButton pendingLabel="Wird gespeichert">{submitLabel}</SubmitButton>
    </form>
  );
}

export function RoleCard({
  role,
  permissionGroups,
  canManage,
  saveAction,
  deleteAction,
}: {
  role: {
    id: string;
    key: string;
    name: string;
    description: string | null;
    rank: number;
    isSystem: boolean;
    memberCount: number;
    permissions: string[];
  };
  permissionGroups: PermissionGroupView[];
  canManage: boolean;
  saveAction: FormAction;
  deleteAction: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const isOwner = role.key === 'owner';

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {role.name}
            {role.isSystem ? <Badge tone="info">System</Badge> : null}
            <Badge>
              {role.memberCount} {role.memberCount === 1 ? 'Person' : 'Personen'}
            </Badge>
          </span>
        }
        description={role.description ?? undefined}
        action={
          canManage ? (
            <Button variant="ghost" size="sm" onClick={() => setEditing((value) => !value)}>
              {editing ? 'Schließen' : 'Bearbeiten'}
            </Button>
          ) : null
        }
      />
      <CardBody className="space-y-3">
        <p className="text-sm text-slate-600">
          {isOwner
            ? 'Vollzugriff auf alle Bereiche.'
            : `${role.permissions.length} ${role.permissions.length === 1 ? 'Berechtigung' : 'Berechtigungen'}`}
        </p>

        {editing && canManage ? (
          <div className="space-y-3 border-t border-slate-100 pt-3">
            <RoleForm
              action={saveAction}
              idPrefix={role.id}
              submitLabel="Rolle speichern"
              permissionGroups={permissionGroups}
              values={role}
              locked={isOwner}
            />

            {!isOwner ? (
              <div className="border-t border-slate-100 pt-3">
                {confirming ? (
                  <form action={deleteAction} className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-slate-600">Rolle wirklich löschen?</span>
                    <SubmitButton variant="danger" size="sm" pendingLabel="Wird gelöscht">
                      Ja, löschen
                    </SubmitButton>
                    <Button variant="secondary" size="sm" type="button" onClick={() => setConfirming(false)}>
                      Abbrechen
                    </Button>
                  </form>
                ) : (
                  <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
                    Rolle löschen
                  </Button>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

export function AccountRow({
  account,
  canManage,
  resetAction,
  revokeAction,
}: {
  account: {
    personId: string;
    name: string;
    initials: string;
    email: string;
    roles: string[];
    lastLogin: string | null;
    isSuperAdmin: boolean;
    mustChangePassword: boolean;
    locked: boolean;
    isSelf: boolean;
    membershipHref: string;
  };
  canManage: boolean;
  resetAction: FormAction;
  revokeAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(resetAction, idleState);
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar initials={account.initials} />
          <div className="min-w-0">
            <Link href={account.membershipHref} className="block truncate text-sm font-medium text-slate-800 hover:text-brand-700">
              {account.name}
            </Link>
            <p className="truncate text-xs text-slate-500">{account.email}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {account.isSuperAdmin ? <Badge tone="brand">Plattformverwaltung</Badge> : null}
              {account.roles.map((role) => (
                <Badge key={role}>{role}</Badge>
              ))}
              {account.locked ? <Badge tone="danger">Gesperrt</Badge> : null}
              {account.mustChangePassword ? <Badge tone="warning">Passwortwechsel nötig</Badge> : null}
            </div>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-xs text-slate-500">
            {account.lastLogin ? `Zuletzt: ${account.lastLogin}` : 'Noch nie angemeldet'}
          </p>
          {canManage ? (
            <Button variant="ghost" size="sm" onClick={() => setOpen((value) => !value)}>
              {open ? 'Schließen' : 'Verwalten'}
            </Button>
          ) : null}
        </div>
      </div>

      {open && canManage ? (
        <div className="mt-3 space-y-3 rounded-lg bg-slate-50 p-3">
          <form action={formAction} className="space-y-2">
            <FormMessage state={state} />
            <Field
              label="Neues Passwort setzen"
              htmlFor={`password-${account.personId}`}
              hint="Mindestens zehn Zeichen. Beim nächsten Anmelden wird eine Änderung verlangt."
            >
              <input
                id={`password-${account.personId}`}
                name="password"
                type="text"
                autoComplete="off"
                minLength={10}
              />
            </Field>
            <SubmitButton variant="secondary" size="sm" pendingLabel="Wird gesetzt">
              Passwort setzen
            </SubmitButton>
          </form>

          {!account.isSelf ? (
            <div className="border-t border-slate-200 pt-2">
              {confirming ? (
                <form action={revokeAction} className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-slate-600">Zugang entziehen? Die Stammdaten bleiben erhalten.</span>
                  <SubmitButton variant="danger" size="sm" pendingLabel="Wird entzogen">
                    Ja, entziehen
                  </SubmitButton>
                  <Button variant="secondary" size="sm" type="button" onClick={() => setConfirming(false)}>
                    Abbrechen
                  </Button>
                </form>
              ) : (
                <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
                  Zugang entziehen
                </Button>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

export function InviteForm({
  action,
  roles,
}: {
  action: FormAction;
  roles: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState(action, idleState);

  return (
    <form action={formAction} className="space-y-3">
      <FormMessage state={state} />

      <Field label="E-Mail-Adresse" htmlFor="invite-email" required>
        <input id="invite-email" name="email" type="email" required placeholder="name@example.org" />
      </Field>

      <Field label="Rolle" htmlFor="invite-role">
        <select id="invite-role" name="roleId" defaultValue="">
          <option value="">Ohne Rolle</option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Persönliche Nachricht" htmlFor="invite-message">
        <textarea id="invite-message" name="message" rows={3} />
      </Field>

      <SubmitButton pendingLabel="Wird versendet">Einladung senden</SubmitButton>
    </form>
  );
}
