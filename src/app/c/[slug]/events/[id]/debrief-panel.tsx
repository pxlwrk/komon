'use client';

import { useActionState } from 'react';

import { FormMessage, SubmitButton } from '@/components/form';
import { Alert, Badge, Card, CardBody, CardHeader, Field, StatTile } from '@/components/ui';
import { idleState, type ActionState } from '@/lib/action-state';

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function DebriefPanel({
  event,
  feedback,
  canDebrief,
  saveAction,
  followUpAction,
}: {
  event: {
    minutes: string | null;
    debriefNotes: string | null;
    lessonsLearned: string | null;
    actualCost: string;
    plannedBudget: number | null;
    done: boolean;
    doneLabel: string | null;
    title: string;
    attendedCount: number;
    acceptedCount: number;
    noShowCount: number;
  };
  feedback: { id: string; rating: number | null; comment: string | null; author: string; submittedAt: string }[];
  canDebrief: boolean;
  saveAction: FormAction;
  followUpAction: FormAction;
}) {
  const [state, formAction] = useActionState(saveAction, idleState);
  const [followState, followFormAction] = useActionState(followUpAction, idleState);

  const averageRating =
    feedback.filter((entry) => entry.rating !== null).length > 0
      ? feedback.reduce((sum, entry) => sum + (entry.rating ?? 0), 0) /
        feedback.filter((entry) => entry.rating !== null).length
      : null;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {event.done ? (
          <Alert tone="success" title="Nachbereitung abgeschlossen">
            Abgeschlossen am {event.doneLabel}.
          </Alert>
        ) : null}

        <Card>
          <CardHeader
            title="Protokoll und Auswertung"
            description="Halten Sie fest, was besprochen wurde und was beim nächsten Mal besser laufen soll."
          />
          <CardBody>
            {canDebrief ? (
              <form action={formAction} className="space-y-4">
                <FormMessage state={state} />

                <Field label="Protokoll" htmlFor="minutes">
                  <textarea id="minutes" name="minutes" rows={10} defaultValue={event.minutes ?? ''} />
                </Field>

                <Field label="Notizen zur Durchführung" htmlFor="debriefNotes">
                  <textarea
                    id="debriefNotes"
                    name="debriefNotes"
                    rows={4}
                    defaultValue={event.debriefNotes ?? ''}
                  />
                </Field>

                <Field label="Das nehmen wir mit" htmlFor="lessonsLearned">
                  <textarea
                    id="lessonsLearned"
                    name="lessonsLearned"
                    rows={4}
                    defaultValue={event.lessonsLearned ?? ''}
                  />
                </Field>

                <Field label="Tatsächliche Kosten in Euro" htmlFor="actualCost">
                  <input id="actualCost" name="actualCost" inputMode="decimal" defaultValue={event.actualCost} />
                </Field>

                <div className="flex items-center gap-2">
                  <input id="markDone" name="markDone" type="checkbox" defaultChecked={event.done} />
                  <label htmlFor="markDone" className="font-normal">
                    Nachbereitung als abgeschlossen kennzeichnen und Event auf „Abgeschlossen“ setzen
                  </label>
                </div>

                <SubmitButton pendingLabel="Wird gespeichert">Nachbereitung speichern</SubmitButton>
              </form>
            ) : (
              <div className="space-y-4">
                {event.minutes ? (
                  <div>
                    <p className="text-sm font-medium text-slate-700">Protokoll</p>
                    <p className="prose-note">{event.minutes}</p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Es liegt noch kein Protokoll vor.</p>
                )}
                {event.lessonsLearned ? (
                  <div>
                    <p className="text-sm font-medium text-slate-700">Das nehmen wir mit</p>
                    <p className="prose-note">{event.lessonsLearned}</p>
                  </div>
                ) : null}
              </div>
            )}
          </CardBody>
        </Card>

        {canDebrief ? (
          <Card>
            <CardHeader title="Nachlese versenden" description="Ein Dankeschön mit Protokoll und Ausblick." />
            <CardBody>
              <form action={followFormAction} className="space-y-3">
                <FormMessage state={followState} />

                <Field label="Betreff" htmlFor="followup-subject">
                  <input
                    id="followup-subject"
                    name="subject"
                    defaultValue={`Nachlese: ${event.title}`}
                  />
                </Field>

                <Field label="Text" htmlFor="followup-body" required>
                  <textarea
                    id="followup-body"
                    name="bodyText"
                    rows={8}
                    required
                    placeholder={'Vielen Dank für Ihre Teilnahme.\n\n...'}
                  />
                </Field>

                <Field label="Empfängerkreis" htmlFor="followup-audience">
                  <select id="followup-audience" name="audience" defaultValue="ATTENDED">
                    <option value="ATTENDED">Alle, die teilgenommen haben</option>
                    <option value="ACCEPTED">Alle mit Zusage</option>
                    <option value="ALL">Alle auf der Liste</option>
                  </select>
                </Field>

                <SubmitButton pendingLabel="Wird versendet">Nachlese versenden</SubmitButton>
              </form>
            </CardBody>
          </Card>
        ) : null}
      </div>

      <div className="space-y-6">
        <div className="grid gap-4">
          <StatTile label="Teilgenommen" value={event.attendedCount} hint={`von ${event.acceptedCount} Zusagen`} />
          <StatTile label="Nicht erschienen" value={event.noShowCount} />
          {averageRating !== null ? (
            <StatTile label="Durchschnittliche Bewertung" value={averageRating.toFixed(1)} hint="von 5" />
          ) : null}
          {event.plannedBudget !== null ? (
            <StatTile
              label="Budget"
              value={`${event.plannedBudget.toFixed(2)} €`}
              hint={event.actualCost ? `Tatsächlich: ${event.actualCost} €` : 'Kosten noch offen'}
            />
          ) : null}
        </div>

        <Card>
          <CardHeader title="Rückmeldungen" description={`${feedback.length} Beiträge`} />
          <CardBody>
            {feedback.length === 0 ? (
              <p className="text-sm text-slate-500">Bisher keine Rückmeldungen.</p>
            ) : (
              <ul className="space-y-3">
                {feedback.map((entry) => (
                  <li key={entry.id} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-slate-800">{entry.author}</span>
                      {entry.rating !== null ? <Badge tone="brand">{entry.rating} von 5</Badge> : null}
                    </div>
                    {entry.comment ? <p className="mt-1 prose-note">{entry.comment}</p> : null}
                    <p className="mt-1 text-xs text-slate-500">{entry.submittedAt}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
