'use client';

import { SubmitButton } from '@/components/form';

export function MessageActions({
  status,
  failedCount,
  sendAction,
  cancelAction,
  retryAction,
}: {
  status: string;
  failedCount: number;
  sendAction: () => Promise<void>;
  cancelAction: () => Promise<void>;
  retryAction: () => Promise<void>;
}) {
  const canRelease = status === 'DRAFT' || status === 'SCHEDULED' || status === 'CANCELLED';
  const canCancel = status === 'DRAFT' || status === 'SCHEDULED' || status === 'QUEUED';

  return (
    <div className="flex flex-wrap gap-2">
      {canRelease ? (
        <form action={sendAction}>
          <SubmitButton pendingLabel="Wird versendet">Jetzt versenden</SubmitButton>
        </form>
      ) : null}

      {failedCount > 0 ? (
        <form action={retryAction}>
          <SubmitButton variant="secondary" pendingLabel="Wird wiederholt">
            {failedCount} fehlgeschlagene erneut versuchen
          </SubmitButton>
        </form>
      ) : null}

      {canCancel ? (
        <form action={cancelAction}>
          <SubmitButton variant="danger" pendingLabel="Wird abgebrochen">
            Versand abbrechen
          </SubmitButton>
        </form>
      ) : null}
    </div>
  );
}
