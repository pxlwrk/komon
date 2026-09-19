'use client';

import { useActionState, useState } from 'react';

import { FormMessage, SubmitButton } from '@/components/form';
import { Badge, Button, Card, CardBody, CardHeader, Field } from '@/components/ui';
import { idleState, type ActionState } from '@/lib/action-state';
import { formatBytes } from '@/lib/format';

export function ModerationItem({
  message,
  approveAction,
  rejectAction,
}: {
  message: {
    id: string;
    subject: string;
    fromName: string | null;
    fromAddress: string;
    senderName: string | null;
    bodyText: string;
    receivedAt: string;
    reason: string | null;
    sizeBytes: number;
  };
  approveAction: () => Promise<void>;
  rejectAction: (state: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [state, rejectFormAction] = useActionState(rejectAction, idleState);

  const preview = message.bodyText.length > 600 && !expanded
    ? `${message.bodyText.slice(0, 600)}…`
    : message.bodyText;

  return (
    <Card>
      <CardHeader
        title={message.subject}
        description={`${message.fromName ?? message.senderName ?? 'Unbekannt'} <${message.fromAddress}> · ${message.receivedAt}`}
      />
      <CardBody className="space-y-4">
        {message.reason ? <Badge tone="warning">{message.reason}</Badge> : null}

        <p className="prose-note rounded-lg bg-slate-50 p-3">{preview}</p>

        {message.bodyText.length > 600 ? (
          <Button variant="ghost" size="sm" onClick={() => setExpanded((value) => !value)}>
            {expanded ? 'Weniger anzeigen' : 'Vollständig anzeigen'}
          </Button>
        ) : null}

        <p className="text-xs text-slate-500">Umfang: {formatBytes(message.sizeBytes)}</p>

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <form action={approveAction}>
            <SubmitButton pendingLabel="Wird verteilt">Freigeben und verteilen</SubmitButton>
          </form>
          <Button variant="secondary" onClick={() => setRejecting((value) => !value)}>
            {rejecting ? 'Abbrechen' : 'Ablehnen'}
          </Button>
        </div>

        {rejecting ? (
          <form action={rejectFormAction} className="space-y-3 rounded-lg bg-slate-50 p-3">
            <FormMessage state={state} />

            <Field label="Begründung" htmlFor={`reason-${message.id}`}>
              <textarea
                id={`reason-${message.id}`}
                name="reason"
                rows={2}
                placeholder="Der Beitrag passt thematisch nicht zu dieser Liste."
              />
            </Field>

            <div className="flex items-center gap-2">
              <input id={`notify-${message.id}`} name="notify" type="checkbox" defaultChecked />
              <label htmlFor={`notify-${message.id}`} className="font-normal">
                Absenderin oder Absender benachrichtigen
              </label>
            </div>

            <SubmitButton variant="danger" size="sm" pendingLabel="Wird abgelehnt">
              Ablehnen
            </SubmitButton>
          </form>
        ) : null}
      </CardBody>
    </Card>
  );
}
