'use client';

import { useActionState, useState } from 'react';

import { FormMessage, SubmitButton } from '@/components/form';
import { Field } from '@/components/ui';
import { idleState, type ActionState } from '@/lib/action-state';

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function ResponseForm({
  action,
  currentStatus,
  guestCount,
  note,
  dietaryNotes,
  allowGuests,
}: {
  action: FormAction;
  currentStatus: string;
  guestCount: number;
  note: string | null;
  dietaryNotes: string | null;
  allowGuests: boolean;
}) {
  const [state, formAction] = useActionState(action, idleState);
  const [answer, setAnswer] = useState(
    ['ACCEPTED', 'DECLINED', 'TENTATIVE'].includes(currentStatus) ? currentStatus : '',
  );

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />

      <input type="hidden" name="answer" value={answer} />

      <div className="grid gap-2 sm:grid-cols-3">
        {(
          [
            ['ACCEPTED', 'Ja, ich komme'],
            ['TENTATIVE', 'Vielleicht'],
            ['DECLINED', 'Leider nicht'],
          ] as const
        ).map(([value, title]) => (
          <button
            key={value}
            type="button"
            onClick={() => setAnswer(value)}
            className={
              answer === value
                ? 'rounded-lg border-2 border-brand-600 bg-brand-50 px-4 py-3 text-sm font-medium text-brand-800'
                : 'rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 hover:bg-slate-50'
            }
            aria-pressed={answer === value}
          >
            {title}
          </button>
        ))}
      </div>

      {answer === 'ACCEPTED' && allowGuests ? (
        <Field label="Begleitpersonen" htmlFor="guestCount" hint="Wie viele Personen bringen Sie mit?">
          <input id="guestCount" name="guestCount" type="number" min="0" max="10" defaultValue={guestCount} />
        </Field>
      ) : (
        <input type="hidden" name="guestCount" value={guestCount} />
      )}

      {answer === 'ACCEPTED' ? (
        <Field label="Hinweise zur Verpflegung" htmlFor="dietaryNotes">
          <input
            id="dietaryNotes"
            name="dietaryNotes"
            defaultValue={dietaryNotes ?? ''}
            placeholder="vegetarisch, glutenfrei"
          />
        </Field>
      ) : null}

      <Field label="Nachricht an die Organisation" htmlFor="note">
        <textarea id="note" name="note" rows={3} defaultValue={note ?? ''} />
      </Field>

      <SubmitButton disabled={!answer} pendingLabel="Wird gespeichert">
        Rückmeldung absenden
      </SubmitButton>
    </form>
  );
}

export function FeedbackForm({ action }: { action: FormAction }) {
  const [state, formAction] = useActionState(action, idleState);
  const [rating, setRating] = useState(0);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />

      <input type="hidden" name="rating" value={rating || ''} />

      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">Bewertung</p>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              aria-label={`${value} von 5`}
              aria-pressed={rating === value}
              className={
                rating >= value
                  ? 'h-10 w-10 rounded-lg bg-brand-600 text-sm font-semibold text-white'
                  : 'h-10 w-10 rounded-lg border border-slate-300 bg-white text-sm text-slate-600 hover:bg-slate-50'
              }
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      <Field label="Was möchten Sie uns mitgeben?" htmlFor="comment">
        <textarea id="comment" name="comment" rows={4} />
      </Field>

      <SubmitButton pendingLabel="Wird gesendet">Rückmeldung senden</SubmitButton>
    </form>
  );
}
