'use client';

import Link from 'next/link';
import { useActionState, useMemo, useState } from 'react';

import { FormMessage, SubmitButton } from '@/components/form';
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Field } from '@/components/ui';
import { idleState, type ActionState } from '@/lib/action-state';
import { PARTICIPATION_SOURCE, PARTICIPATION_STATUS, label } from '@/lib/enums';

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;
type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

export type ParticipationView = {
  id: string;
  name: string | null;
  email: string;
  status: string;
  statusTone: BadgeTone;
  source: string;
  guestCount: number;
  note: string | null;
  respondedAt: string | null;
  invitedAt: string | null;
  checkedIn: boolean;
  noShow: boolean;
  personHref: string | null;
  checkInAction: () => Promise<void>;
  removeAction: () => Promise<void>;
  acceptAction: () => Promise<void>;
  declineAction: () => Promise<void>;
};

export function ParticipantsPanel({
  participations,
  people,
  groups,
  canInvite,
  canManage,
  canCheckIn,
  addAction,
  inviteAction,
  closeAttendanceAction,
}: {
  participations: ParticipationView[];
  people: { id: string; name: string; email: string }[];
  groups: { id: string; name: string }[];
  canInvite: boolean;
  canManage: boolean;
  canCheckIn: boolean;
  addAction: FormAction;
  inviteAction: FormAction;
  closeAttendanceAction: () => Promise<void>;
}) {
  const [filter, setFilter] = useState('');

  const filtered = useMemo(() => {
    if (!filter) return participations;
    return participations.filter((entry) => entry.status === filter);
  }, [filter, participations]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const entry of participations) {
      counts[entry.status] = (counts[entry.status] ?? 0) + 1;
    }
    return counts;
  }, [participations]);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader
            title="Teilnehmende"
            description={`${participations.length} Einträge`}
            action={
              canCheckIn ? (
                <form action={closeAttendanceAction}>
                  <SubmitButton variant="secondary" size="sm" pendingLabel="Wird abgeschlossen">
                    Anwesenheit abschließen
                  </SubmitButton>
                </form>
              ) : null
            }
          />
          <CardBody className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFilter('')}
                className={
                  filter === ''
                    ? 'rounded-full bg-brand-600 px-3 py-1 text-xs font-medium text-white'
                    : 'rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50'
                }
              >
                Alle ({participations.length})
              </button>
              {Object.entries(statusCounts).map(([status, count]) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setFilter(status)}
                  className={
                    filter === status
                      ? 'rounded-full bg-brand-600 px-3 py-1 text-xs font-medium text-white'
                      : 'rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50'
                  }
                >
                  {label(PARTICIPATION_STATUS, status)} ({count})
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <EmptyState
                title="Noch niemand eingetragen"
                description={canInvite ? 'Fügen Sie rechts Personen hinzu.' : undefined}
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {filtered.map((entry) => (
                  <ParticipantRow
                    key={entry.id}
                    entry={entry}
                    canManage={canManage}
                    canCheckIn={canCheckIn}
                  />
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="space-y-6">
        {canInvite ? (
          <>
            <Card>
              <CardHeader title="Personen hinzufügen" />
              <CardBody>
                <AddParticipantsForm action={addAction} people={people} groups={groups} />
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Einladungen versenden" description="Jede Person erhält einen persönlichen Link zur Rückmeldung." />
              <CardBody>
                <InviteForm action={inviteAction} />
              </CardBody>
            </Card>
          </>
        ) : null}
      </div>
    </div>
  );
}

function ParticipantRow({
  entry,
  canManage,
  canCheckIn,
}: {
  entry: ParticipationView;
  canManage: boolean;
  canCheckIn: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <li className="py-2.5 first:pt-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-800">
            {entry.name || entry.email}
            {entry.guestCount > 0 ? (
              <span className="ml-1 text-xs text-slate-500">+{entry.guestCount}</span>
            ) : null}
          </p>
          <p className="truncate text-xs text-slate-500">{entry.email}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            <Badge tone={entry.statusTone}>{label(PARTICIPATION_STATUS, entry.status)}</Badge>
            {entry.checkedIn ? <Badge tone="success">Anwesend</Badge> : null}
            {entry.noShow ? <Badge tone="danger">Nicht erschienen</Badge> : null}
            <Badge>{label(PARTICIPATION_SOURCE, entry.source)}</Badge>
          </div>
          {entry.note ? <p className="mt-1 text-xs text-slate-600">Anmerkung: {entry.note}</p> : null}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {canCheckIn ? (
            <form action={entry.checkInAction}>
              <SubmitButton variant={entry.checkedIn ? 'secondary' : 'primary'} size="sm" pendingLabel="…">
                {entry.checkedIn ? 'Zurücknehmen' : 'Anwesend'}
              </SubmitButton>
            </form>
          ) : null}
          {canManage ? (
            <Button variant="ghost" size="sm" onClick={() => setOpen((value) => !value)}>
              Mehr
            </Button>
          ) : null}
        </div>
      </div>

      {open && canManage ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-600">
          {entry.invitedAt ? <span>Eingeladen: {entry.invitedAt}</span> : <span>Noch nicht eingeladen</span>}
          {entry.respondedAt ? <span>· Rückmeldung: {entry.respondedAt}</span> : null}

          <div className="ml-auto flex flex-wrap gap-1">
            <form action={entry.acceptAction}>
              <SubmitButton variant="secondary" size="sm" pendingLabel="…">
                Als zugesagt
              </SubmitButton>
            </form>
            <form action={entry.declineAction}>
              <SubmitButton variant="secondary" size="sm" pendingLabel="…">
                Als abgesagt
              </SubmitButton>
            </form>
            {entry.personHref ? (
              <Link
                href={entry.personHref}
                className="rounded-lg px-2 py-1 text-slate-600 hover:bg-white hover:text-brand-700"
              >
                Stammdaten
              </Link>
            ) : null}
            <form action={entry.removeAction}>
              <SubmitButton variant="danger" size="sm" pendingLabel="…">
                Entfernen
              </SubmitButton>
            </form>
          </div>
        </div>
      ) : null}
    </li>
  );
}

function AddParticipantsForm({
  action,
  people,
  groups,
}: {
  action: FormAction;
  people: { id: string; name: string; email: string }[];
  groups: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState(action, idleState);
  const [source, setSource] = useState<'ALL' | 'GROUP' | 'SELECTION' | 'EXTERNAL'>('SELECTION');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return people;
    return people.filter(
      (person) =>
        person.name.toLowerCase().includes(needle) || person.email.toLowerCase().includes(needle),
    );
  }, [people, search]);

  return (
    <form action={formAction} className="space-y-3">
      <FormMessage state={state} />
      <input type="hidden" name="source" value={source === 'EXTERNAL' ? 'SELECTION' : source} />

      <div className="space-y-1.5">
        {(
          [
            ['SELECTION', 'Einzelne Personen'],
            ['GROUP', 'Eine Gruppe'],
            ['ALL', 'Alle aktiven Mitglieder'],
            ['EXTERNAL', 'Gäste ohne Mitgliedschaft'],
          ] as const
        ).map(([value, title]) => (
          <label key={value} className="flex items-center gap-2 font-normal">
            <input
              type="radio"
              name="sourceChoice"
              checked={source === value}
              onChange={() => setSource(value)}
            />
            <span className="text-sm text-slate-700">{title}</span>
          </label>
        ))}
      </div>

      {source === 'GROUP' ? (
        <Field label="Gruppe" htmlFor="participant-group">
          <select id="participant-group" name="groupId" defaultValue="">
            <option value="">Bitte wählen</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      {source === 'SELECTION' ? (
        <>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Personen suchen"
          />
          <div className="scroll-area max-h-56 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
            {filtered.map((person) => (
              <label
                key={person.id}
                className="flex items-center gap-2 rounded px-1.5 py-1 font-normal hover:bg-slate-50"
              >
                <input type="checkbox" name="personIds" value={person.id} />
                <span className="min-w-0">
                  <span className="block truncate text-sm text-slate-800">{person.name}</span>
                  <span className="block truncate text-xs text-slate-500">{person.email}</span>
                </span>
              </label>
            ))}
          </div>
        </>
      ) : null}

      {source === 'EXTERNAL' ? (
        <Field
          label="Adressen"
          htmlFor="participant-external"
          hint="Eine Adresse je Zeile, gern mit Namen: Anna Berger <anna@example.org>"
        >
          <textarea id="participant-external" name="external" rows={4} />
        </Field>
      ) : null}

      <SubmitButton pendingLabel="Wird hinzugefügt">Zur Liste hinzufügen</SubmitButton>
    </form>
  );
}

function InviteForm({ action }: { action: FormAction }) {
  const [state, formAction] = useActionState(action, idleState);

  return (
    <form action={formAction} className="space-y-3">
      <FormMessage state={state} />

      <Field label="Ergänzender Text" htmlFor="invite-message" hint="Optional. Wird unter die Eckdaten gesetzt.">
        <textarea id="invite-message" name="message" rows={3} />
      </Field>

      <div className="flex items-center gap-2">
        <input id="invite-onlyNew" name="onlyNew" type="checkbox" defaultChecked />
        <label htmlFor="invite-onlyNew" className="font-normal">
          Nur an noch nicht angeschriebene Personen
        </label>
      </div>

      <SubmitButton pendingLabel="Wird versendet">Einladungen versenden</SubmitButton>
    </form>
  );
}
