'use client';

import { useFormStatus } from 'react-dom';
import clsx from 'clsx';

import { Alert, buttonClass } from '@/components/ui';
import type { ActionState } from '@/lib/action-state';

/** Schaltflaeche, die waehrend des Absendens gesperrt ist. */
export function SubmitButton({
  children,
  pendingLabel,
  variant = 'primary',
  size = 'md',
  className,
  ...rest
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  className?: string;
} & React.ComponentProps<'button'>) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || rest.disabled}
      className={clsx(buttonClass(variant, size), className)}
      {...rest}
    >
      {pending ? (pendingLabel ?? 'Einen Moment bitte') : children}
    </button>
  );
}

/** Zeigt das Ergebnis einer Server Action an. */
export function FormMessage({ state }: { state: ActionState }) {
  if (state.status === 'idle' || !state.message) return null;
  return (
    <Alert tone={state.status === 'success' ? 'success' : 'danger'}>{state.message}</Alert>
  );
}

export function FieldError({ state, name }: { state: ActionState; name: string }) {
  const message = state.fieldErrors?.[name];
  if (!message) return null;
  return <p className="text-xs text-red-600">{message}</p>;
}
