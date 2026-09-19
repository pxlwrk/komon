'use client';

import { useState, useTransition } from 'react';

import { SubmitButton } from '@/components/form';
import { Button } from '@/components/ui';

export function StatusBar({
  status,
  statusOptions,
  setStatus,
  deleteAction,
  title,
}: {
  status: string;
  statusOptions: { value: string; title: string }[];
  setStatus: (status: string) => Promise<void>;
  deleteAction: () => Promise<void>;
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
      <label htmlFor="event-status" className="sr-only">
        Status
      </label>
      <select
        id="event-status"
        value={status}
        disabled={pending}
        onChange={(event) => {
          const next = event.target.value;
          startTransition(async () => {
            await setStatus(next);
          });
        }}
        className="w-52"
      >
        {statusOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.title}
          </option>
        ))}
      </select>

      <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
        Löschen
      </Button>
    </div>
  );
}
