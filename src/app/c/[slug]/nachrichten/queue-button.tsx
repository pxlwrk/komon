'use client';

import { SubmitButton } from '@/components/form';
import { Alert } from '@/components/ui';

export function QueueButton({ action, pending }: { action: () => Promise<void>; pending: number }) {
  return (
    <Alert tone="info">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>
          {pending} {pending === 1 ? 'Zustellung wartet' : 'Zustellungen warten'} in der Warteschlange.
        </span>
        <form action={action}>
          <SubmitButton variant="secondary" size="sm" pendingLabel="Versand läuft">
            Versand jetzt anstoßen
          </SubmitButton>
        </form>
      </div>
    </Alert>
  );
}
