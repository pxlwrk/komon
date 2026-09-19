'use client';

import Link from 'next/link';
import { useActionState, useMemo, useState } from 'react';

import { FormMessage, SubmitButton } from '@/components/form';
import { Badge, Button, Card, CardBody, CardHeader, Field } from '@/components/ui';
import { idleState, type ActionState } from '@/lib/action-state';
import {
  MAIL_PREFERENCE,
  SUBSCRIPTION_ROLE,
  SUBSCRIPTION_STATUS,
  mailPreferenceValues,
  subscriptionRoleValues,
  subscriptionStatusValues,
} from '@/lib/enums';

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;
type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

export type SubscriptionView = {
  id: string;
  personId: string;
  name: string;
  email: string;
  role: string;
  roleLabel: string;
  deliveryMode: string;
  status: string;
  statusLabel: string;
  statusTone: BadgeTone;
  moderated: boolean;
  updateAction: FormAction;
  removeAction: () => Promise<void>;
};

export function PostForm({ action }: { action: FormAction }) {
  const [state, formAction] = useActionState(action, idleState);

  return (
    <form action={formAction} className="space-y-3">
      <FormMessage state={state} />

      <Field label="Betreff" htmlFor="post-subject" required>
        <input id="post-subject" name="subject" required />
      </Field>

      <Field label="Text" htmlFor="post-body" required>
        <textarea id="post-body" name="bodyText" rows={6} required />
      </Field>

      <SubmitButton pendingLabel="Wird eingestellt">An die Liste senden</SubmitButton>
    </form>
  );
}

export function SyncButton({ action }: { action: () => Promise<void> }) {
  return (
    <form action={action}>
      <SubmitButton variant="secondary" size="sm" pendingLabel="Wird abgeglichen">
        Jetzt abgleichen
      </SubmitButton>
    </form>
  );
}

export function SubscriberPanel({
  subscriptions,
  candidates,
  canManage,
  detailBase,
  addAction,
}: {
  subscriptions: SubscriptionView[];
  candidates: { personId: string; name: string; email: string }[];
  canManage: boolean;
  detailBase: string;
  addAction: FormAction;
}) {
  const [adding, setAdding] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader
        title="Eingetragene Adressen"
        description={`${subscriptions.length} ${subscriptions.length === 1 ? 'Eintrag' : 'Einträge'}`}
        action={
          canManage ? (
            <Button variant="ghost" size="sm" onClick={() => setAdding((value) => !value)}>
              {adding ? 'Schließen' : 'Hinzufügen'}
            </Button>
          ) : null
        }
      />
      <CardBody className="space-y-4">
        {adding && canManage ? (
          <AddSubscribersForm action={addAction} candidates={candidates} />
        ) : null}

        {subscriptions.length === 0 ? (
          <p className="text-sm text-slate-500">Noch niemand eingetragen.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {subscriptions.map((subscription) => (
              <li key={subscription.id} className="py-2 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{subscription.name}</p>
                    <p className="truncate text-xs text-slate-500">{subscription.email}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {subscription.role !== 'SUBSCRIBER' ? (
                        <Badge tone="brand">{subscription.roleLabel}</Badge>
                      ) : null}
                      <Badge tone={subscription.statusTone}>{subscription.statusLabel}</Badge>
                      {subscription.moderated ? <Badge tone="warning">Einzelfreigabe</Badge> : null}
                      {subscription.deliveryMode !== 'REGULAR' ? (
                        <Badge>
                          {MAIL_PREFERENCE[subscription.deliveryMode as keyof typeof MAIL_PREFERENCE] ??
                            subscription.deliveryMode}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  {canManage ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setExpanded((value) => (value === subscription.id ? null : subscription.id))
                      }
                    >
                      {expanded === subscription.id ? 'Schließen' : 'Ändern'}
                    </Button>
                  ) : null}
                </div>

                {expanded === subscription.id && canManage ? (
                  <SubscriptionEditor subscription={subscription} detailBase={detailBase} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function SubscriptionEditor({
  subscription,
  detailBase,
}: {
  subscription: SubscriptionView;
  detailBase: string;
}) {
  const [state, formAction] = useActionState(subscription.updateAction, idleState);

  return (
    <div className="mt-3 space-y-3 rounded-lg bg-slate-50 p-3">
      <form action={formAction} className="space-y-3">
        <FormMessage state={state} />

        <Field label="Rolle" htmlFor={`role-${subscription.id}`}>
          <select id={`role-${subscription.id}`} name="role" defaultValue={subscription.role}>
            {subscriptionRoleValues.map((value) => (
              <option key={value} value={value}>
                {SUBSCRIPTION_ROLE[value]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Zustellung" htmlFor={`delivery-${subscription.id}`}>
          <select
            id={`delivery-${subscription.id}`}
            name="deliveryMode"
            defaultValue={subscription.deliveryMode}
          >
            {mailPreferenceValues.map((value) => (
              <option key={value} value={value}>
                {MAIL_PREFERENCE[value]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Status" htmlFor={`status-${subscription.id}`}>
          <select id={`status-${subscription.id}`} name="status" defaultValue={subscription.status}>
            {subscriptionStatusValues.map((value) => (
              <option key={value} value={value}>
                {SUBSCRIPTION_STATUS[value]}
              </option>
            ))}
          </select>
        </Field>

        <div className="flex items-center gap-2">
          <input
            id={`moderated-${subscription.id}`}
            name="moderated"
            type="checkbox"
            defaultChecked={subscription.moderated}
          />
          <label htmlFor={`moderated-${subscription.id}`} className="font-normal">
            Beiträge einzeln freigeben
          </label>
        </div>

        <SubmitButton variant="secondary" size="sm" pendingLabel="Wird gespeichert">
          Speichern
        </SubmitButton>
      </form>

      <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-2">
        <Link
          href={`${detailBase}?q=${encodeURIComponent(subscription.email)}`}
          className="text-xs text-brand-700 hover:underline"
        >
          Zum Stammdatensatz
        </Link>
        <form action={subscription.removeAction}>
          <SubmitButton variant="danger" size="sm" pendingLabel="Wird ausgetragen">
            Austragen
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}

function AddSubscribersForm({
  action,
  candidates,
}: {
  action: FormAction;
  candidates: { personId: string; name: string; email: string }[];
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
    <form action={formAction} className="space-y-3 rounded-lg bg-slate-50 p-3">
      <FormMessage state={state} />

      {candidates.length === 0 ? (
        <p className="text-sm text-slate-500">Alle Mitglieder sind bereits eingetragen.</p>
      ) : (
        <>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Personen suchen"
          />

          <div className="scroll-area max-h-56 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2">
            {filtered.map((entry) => (
              <label
                key={entry.personId}
                className="flex items-center gap-2 rounded px-1.5 py-1 font-normal hover:bg-slate-50"
              >
                <input type="checkbox" name="personIds" value={entry.personId} />
                <span className="min-w-0">
                  <span className="block truncate text-sm text-slate-800">{entry.name}</span>
                  <span className="block truncate text-xs text-slate-500">{entry.email}</span>
                </span>
              </label>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Rolle" htmlFor="add-role">
              <select id="add-role" name="role" defaultValue="SUBSCRIBER">
                {subscriptionRoleValues.map((value) => (
                  <option key={value} value={value}>
                    {SUBSCRIPTION_ROLE[value]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Zustellung" htmlFor="add-delivery">
              <select id="add-delivery" name="deliveryMode" defaultValue="REGULAR">
                {mailPreferenceValues.map((value) => (
                  <option key={value} value={value}>
                    {MAIL_PREFERENCE[value]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <SubmitButton variant="secondary" size="sm" pendingLabel="Wird eingetragen">
            Eintragen
          </SubmitButton>
        </>
      )}
    </form>
  );
}

export function DangerZone({ action, name }: { action: () => Promise<void>; name: string }) {
  const [confirming, setConfirming] = useState(false);

  return (
    <Card className="border-red-200">
      <CardHeader
        title="Liste löschen"
        description="Damit verschwinden auch alle Eintragungen und das Archiv dieser Liste."
      />
      <CardBody>
        {confirming ? (
          <form action={action} className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-slate-600">„{name}“ endgültig löschen?</span>
            <SubmitButton variant="danger" size="sm" pendingLabel="Wird gelöscht">
              Ja, löschen
            </SubmitButton>
            <Button variant="secondary" size="sm" type="button" onClick={() => setConfirming(false)}>
              Abbrechen
            </Button>
          </form>
        ) : (
          <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
            Liste löschen
          </Button>
        )}
      </CardBody>
    </Card>
  );
}
