'use client';

import Link from 'next/link';
import { useActionState, useMemo, useState } from 'react';

import { FieldError, FormMessage, SubmitButton } from '@/components/form';
import { Alert, Badge, Card, CardBody, CardHeader, Field, LinkButton } from '@/components/ui';
import { idleState, type ActionState } from '@/lib/action-state';

type Audience = 'ALL' | 'GROUP' | 'TAG' | 'STATUS' | 'SELECTION';

export function ComposeForm({
  action,
  cancelHref,
  canSend,
  reachable,
  template,
  templates,
  groups,
  tags,
  statusOptions,
  members,
  defaultGroupId,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  cancelHref: string;
  canSend: boolean;
  reachable: number;
  template: { subject: string; bodyText: string } | null;
  templates: { id: string; name: string }[];
  groups: { id: string; name: string; count: number }[];
  tags: { id: string; name: string; count: number }[];
  statusOptions: { value: string; label: string }[];
  members: { id: string; name: string; email: string; reachable: boolean }[];
  defaultGroupId: string;
}) {
  const [state, formAction] = useActionState(action, idleState);
  const [audience, setAudience] = useState<Audience>(defaultGroupId ? 'GROUP' : 'ALL');
  const [groupId, setGroupId] = useState(defaultGroupId);
  const [tagId, setTagId] = useState('');
  const [mode, setMode] = useState<'SEND' | 'DRAFT' | 'SCHEDULE'>(canSend ? 'SEND' : 'DRAFT');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  const estimate = useMemo(() => {
    switch (audience) {
      case 'ALL':
        return reachable;
      case 'GROUP':
        return groups.find((group) => group.id === groupId)?.count ?? 0;
      case 'TAG':
        return tags.find((tag) => tag.id === tagId)?.count ?? 0;
      case 'SELECTION':
        return selected.length;
      default:
        return null;
    }
  }, [audience, groupId, groups, reachable, selected.length, tagId, tags]);

  const filteredMembers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return members;
    return members.filter(
      (member) =>
        member.name.toLowerCase().includes(needle) || member.email.toLowerCase().includes(needle),
    );
  }, [members, search]);

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <FormMessage state={state} />

        <Card>
          <CardHeader title="Inhalt" />
          <CardBody className="space-y-4">
            {templates.length > 0 ? (
              <Field label="Vorlage übernehmen" htmlFor="templatePicker">
                <select
                  id="templatePicker"
                  defaultValue=""
                  onChange={(event) => {
                    if (event.target.value) {
                      window.location.href = `?vorlage=${event.target.value}`;
                    }
                  }}
                >
                  <option value="">Ohne Vorlage</option>
                  {templates.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}

            <Field label="Betreff" htmlFor="subject" required>
              <input id="subject" name="subject" required defaultValue={template?.subject ?? ''} />
              <FieldError state={state} name="subject" />
            </Field>

            <Field
              label="Text"
              htmlFor="bodyText"
              required
              hint="Platzhalter: {{vorname}}, {{name}}, {{email}}"
            >
              <textarea
                id="bodyText"
                name="bodyText"
                rows={16}
                required
                defaultValue={template?.bodyText ?? ''}
                placeholder={'Liebe {{vorname}},\n\n...'}
              />
              <FieldError state={state} name="bodyText" />
            </Field>

            <Field label="Antwortadresse" htmlFor="replyTo" hint="Optional. Antworten gehen sonst an die Absenderadresse der Community.">
              <input id="replyTo" name="replyTo" type="email" placeholder="vorstand@example.org" />
            </Field>
          </CardBody>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader title="Empfängerkreis" />
          <CardBody className="space-y-4">
            <input type="hidden" name="audience" value={audience} />

            <div className="space-y-2">
              {(
                [
                  ['ALL', 'Alle erreichbaren Mitglieder'],
                  ['GROUP', 'Eine Gruppe'],
                  ['TAG', 'Ein Schlagwort'],
                  ['STATUS', 'Nach Status'],
                  ['SELECTION', 'Einzelauswahl'],
                ] as [Audience, string][]
              ).map(([value, title]) => (
                <label key={value} className="flex items-center gap-2 font-normal">
                  <input
                    type="radio"
                    name="audienceChoice"
                    checked={audience === value}
                    onChange={() => setAudience(value)}
                  />
                  <span className="text-sm text-slate-700">{title}</span>
                </label>
              ))}
            </div>

            {audience === 'GROUP' ? (
              <Field label="Gruppe" htmlFor="groupId">
                <select
                  id="groupId"
                  name="groupId"
                  value={groupId}
                  onChange={(event) => setGroupId(event.target.value)}
                >
                  <option value="">Bitte wählen</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name} ({group.count})
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}

            {audience === 'TAG' ? (
              <Field label="Schlagwort" htmlFor="tagId">
                <select id="tagId" name="tagId" value={tagId} onChange={(event) => setTagId(event.target.value)}>
                  <option value="">Bitte wählen</option>
                  {tags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name} ({tag.count})
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}

            {audience === 'STATUS' ? (
              <Field label="Status" htmlFor="status">
                <select id="status" name="status" defaultValue="ACTIVE">
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}

            {audience === 'SELECTION' ? (
              <div className="space-y-2">
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Personen suchen"
                />
                <div className="scroll-area max-h-64 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
                  {filteredMembers.map((member) => (
                    <label key={member.id} className="flex items-center gap-2 rounded px-1.5 py-1 font-normal hover:bg-slate-50">
                      <input
                        type="checkbox"
                        name="membershipIds"
                        value={member.id}
                        checked={selected.includes(member.id)}
                        onChange={(event) =>
                          setSelected((current) =>
                            event.target.checked
                              ? [...current, member.id]
                              : current.filter((id) => id !== member.id),
                          )
                        }
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-slate-800">{member.name}</span>
                        <span className="block truncate text-xs text-slate-500">{member.email}</span>
                      </span>
                      {!member.reachable ? <Badge tone="warning">ohne Rundmail</Badge> : null}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            {estimate !== null ? (
              <p className="text-sm text-slate-600">
                Voraussichtlich <strong className="tabular-nums">{estimate}</strong>{' '}
                {estimate === 1 ? 'Empfängerin' : 'Empfängerinnen und Empfänger'}.
              </p>
            ) : null}

            <p className="hint">
              Personen ohne Einverständnis für Rundschreiben und mit abgestellter Zustellung
              bleiben immer außen vor.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Versand" />
          <CardBody className="space-y-4">
            <input type="hidden" name="mode" value={mode} />

            <div className="space-y-2">
              <label className="flex items-center gap-2 font-normal">
                <input
                  type="radio"
                  name="modeChoice"
                  checked={mode === 'SEND'}
                  disabled={!canSend}
                  onChange={() => setMode('SEND')}
                />
                <span className="text-sm text-slate-700">Sofort versenden</span>
              </label>
              <label className="flex items-center gap-2 font-normal">
                <input
                  type="radio"
                  name="modeChoice"
                  checked={mode === 'SCHEDULE'}
                  disabled={!canSend}
                  onChange={() => setMode('SCHEDULE')}
                />
                <span className="text-sm text-slate-700">Zu einem Zeitpunkt versenden</span>
              </label>
              <label className="flex items-center gap-2 font-normal">
                <input
                  type="radio"
                  name="modeChoice"
                  checked={mode === 'DRAFT'}
                  onChange={() => setMode('DRAFT')}
                />
                <span className="text-sm text-slate-700">Als Entwurf sichern</span>
              </label>
            </div>

            {mode === 'SCHEDULE' ? (
              <Field label="Versandzeitpunkt" htmlFor="scheduledAt" required>
                <input id="scheduledAt" name="scheduledAt" type="datetime-local" required />
              </Field>
            ) : null}

            {!canSend ? (
              <Alert tone="info">
                Zum Versenden fehlt Ihnen die Berechtigung. Ihr Entwurf kann von der Verwaltung
                freigegeben werden.
              </Alert>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <SubmitButton pendingLabel="Wird verarbeitet">
                {mode === 'SEND' ? 'Jetzt versenden' : mode === 'SCHEDULE' ? 'Versand planen' : 'Entwurf sichern'}
              </SubmitButton>
              <LinkButton href={cancelHref} variant="secondary">
                Abbrechen
              </LinkButton>
            </div>
          </CardBody>
        </Card>

        <p className="text-xs text-slate-500">
          Eine Übersicht aller Nachrichten finden Sie unter{' '}
          <Link href={cancelHref} className="text-brand-700 hover:underline">
            Nachrichten
          </Link>
          .
        </p>
      </div>
    </form>
  );
}
