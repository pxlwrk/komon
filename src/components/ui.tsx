import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import clsx from 'clsx';

// --- Grundbausteine --------------------------------------------------------

export function Card({
  children,
  className,
  ...rest
}: { children: ReactNode; className?: string } & ComponentProps<'section'>) {
  return (
    <section className={clsx('card', className)} {...rest}>
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {description ? <p className="mt-0.5 text-sm text-slate-500">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('px-5 py-4', className)}>{children}</div>;
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
}) {
  return (
    <header className="mb-6">
      {breadcrumb ? <div className="mb-2 text-sm text-slate-500">{breadcrumb}</div> : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          {description ? <p className="mt-1 max-w-3xl text-sm text-slate-600">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

// --- Schaltflaechen --------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md';

const buttonBase =
  'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:cursor-not-allowed disabled:opacity-60';

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-brand-600 text-white shadow-sm hover:bg-brand-700',
  secondary: 'border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  danger: 'border border-red-200 bg-white text-red-700 shadow-sm hover:bg-red-50',
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
};

export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md'): string {
  return clsx(buttonBase, buttonVariants[variant], buttonSizes[size]);
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...rest
}: ComponentProps<'button'> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button className={clsx(buttonClass(variant, size), className)} {...rest} />;
}

export function LinkButton({
  variant = 'primary',
  size = 'md',
  className,
  ...rest
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <Link className={clsx(buttonClass(variant, size), className)} {...rest} />;
}

// --- Anzeigen --------------------------------------------------------------

type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

const badgeTones: Record<BadgeTone, string> = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  brand: 'bg-brand-50 text-brand-700 ring-brand-200',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200',
  danger: 'bg-red-50 text-red-700 ring-red-200',
  info: 'bg-sky-50 text-sky-700 ring-sky-200',
};

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Ordnet Statuswerte einer passenden Farbe zu. */
export function statusTone(status: string): BadgeTone {
  switch (status) {
    case 'ACTIVE':
    case 'SENT':
    case 'PUBLISHED':
    case 'DISTRIBUTED':
    case 'APPROVED':
    case 'ACCEPTED':
    case 'DONE':
    case 'COMPLETED':
      return 'success';
    case 'PENDING':
    case 'SCHEDULED':
    case 'IN_REVIEW':
    case 'QUEUED':
    case 'SENDING':
    case 'TENTATIVE':
    case 'WAITLIST':
    case 'IN_PROGRESS':
    case 'PLANNING':
    case 'RUNNING':
      return 'warning';
    case 'FAILED':
    case 'REJECTED':
    case 'BLOCKED':
    case 'CANCELLED':
    case 'DECLINED':
    case 'BOUNCED':
    case 'BOUNCING':
      return 'danger';
    case 'DRAFT':
    case 'IDEA':
    case 'INVITED':
      return 'info';
    default:
      return 'neutral';
  }
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {description ? <p className="max-w-md text-sm text-slate-500">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  href?: string;
}) {
  const content = (
    <>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className="card block px-5 py-4 transition hover:border-brand-300 hover:shadow">
        {content}
      </Link>
    );
  }
  return <div className="card px-5 py-4">{content}</div>;
}

// --- Tabellen --------------------------------------------------------------

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="overflow-x-auto scroll-area">
      <table className={clsx('w-full min-w-full border-collapse text-sm', className)}>{children}</table>
    </div>
  );
}

export function Th({
  children,
  className,
  ...rest
}: ComponentProps<'th'> & { children?: ReactNode }) {
  return (
    <th
      className={clsx(
        'border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500',
        className,
      )}
      {...rest}
    >
      {children}
    </th>
  );
}

export function Td({ children, className, ...rest }: ComponentProps<'td'> & { children?: ReactNode }) {
  return (
    <td className={clsx('border-b border-slate-100 px-4 py-2.5 align-middle text-slate-700', className)} {...rest}>
      {children}
    </td>
  );
}

// --- Rueckmeldungen --------------------------------------------------------

export function Alert({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
  children?: ReactNode;
}) {
  const tones = {
    info: 'border-sky-200 bg-sky-50 text-sky-900',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    danger: 'border-red-200 bg-red-50 text-red-900',
  } as const;

  return (
    <div className={clsx('rounded-lg border px-4 py-3 text-sm', tones[tone])} role="status">
      {title ? <p className="font-medium">{title}</p> : null}
      {children ? <div className={clsx(title && 'mt-0.5')}>{children}</div> : null}
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  required,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx('field', className)}>
      <label htmlFor={htmlFor}>
        {label}
        {required ? <span className="ml-0.5 text-red-600">*</span> : null}
      </label>
      {children}
      {hint && !error ? <p className="hint">{hint}</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

export function Avatar({ initials, className }: { initials: string; className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800',
        className,
      )}
      aria-hidden
    >
      {initials}
    </span>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{children}</h2>
      {action}
    </div>
  );
}
