'use client';

import Link from 'next/link';
import { useActionState, useState, useTransition } from 'react';

import { FormMessage, SubmitButton } from '@/components/form';
import { Button, Card, CardBody, CardHeader, Field } from '@/components/ui';
import { idleState, type ActionState } from '@/lib/action-state';

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function EntryToolbar({
  status,
  statusOptions,
  setStatus,
  deleteAction,
  newsletterHref,
  title,
}: {
  status: string;
  statusOptions: { value: string; title: string }[];
  setStatus: (status: string) => Promise<void>;
  deleteAction: () => Promise<void>;
  newsletterHref: string | null;
  title: string;
}) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <form action={deleteAction} className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-600">„{title}“ löschen?</span>
        <SubmitButton variant="danger" size="sm" pendingLabel="Wird gelöscht">
          Ja, löschen
        </SubmitButton>
        <Button variant="secondary" size="sm" type="button" onClick={() => setConfirming(false)}>
          Abbrechen
        </Button>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="journal-status" className="sr-only">
        Status
      </label>
      <select
        id="journal-status"
        value={status}
        disabled={pending}
        onChange={(event) => {
          const next = event.target.value;
          startTransition(async () => {
            await setStatus(next);
          });
        }}
        className="w-44"
      >
        {statusOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.title}
          </option>
        ))}
      </select>

      {newsletterHref ? (
        <Link
          href={newsletterHref}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Als Rundschreiben
        </Link>
      ) : null}

      <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
        Löschen
      </Button>
    </div>
  );
}

export function CommentSection({
  comments,
  addAction,
}: {
  comments: {
    id: string;
    body: string;
    author: string;
    createdAt: string;
    canDelete: boolean;
    deleteAction: () => Promise<void>;
  }[];
  addAction: FormAction;
}) {
  const [state, formAction] = useActionState(addAction, idleState);

  return (
    <Card>
      <CardHeader
        title="Abstimmung"
        description={`${comments.length} ${comments.length === 1 ? 'Kommentar' : 'Kommentare'}`}
      />
      <CardBody className="space-y-4">
        {comments.length === 0 ? (
          <p className="text-sm text-slate-500">Noch keine Kommentare. Starten Sie die Abstimmung.</p>
        ) : (
          <ul className="space-y-3">
            {comments.map((comment) => (
              <li key={comment.id} className="rounded-lg bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800">{comment.author}</p>
                    <p className="text-xs text-slate-500">{comment.createdAt}</p>
                  </div>
                  {comment.canDelete ? (
                    <form action={comment.deleteAction}>
                      <button
                        type="submit"
                        className="rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-red-50 hover:text-red-700"
                      >
                        Entfernen
                      </button>
                    </form>
                  ) : null}
                </div>
                <p className="mt-2 prose-note">{comment.body}</p>
              </li>
            ))}
          </ul>
        )}

        <form action={formAction} className="space-y-2 border-t border-slate-100 pt-4">
          <FormMessage state={state} />
          <Field label="Kommentar schreiben" htmlFor="comment-body">
            <textarea id="comment-body" name="body" rows={3} required />
          </Field>
          <SubmitButton variant="secondary" size="sm" pendingLabel="Wird gespeichert">
            Kommentar hinzufügen
          </SubmitButton>
        </form>
      </CardBody>
    </Card>
  );
}
