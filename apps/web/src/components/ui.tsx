import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { ApiError } from '@truhost/api-client';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function Button({
  variant = 'primary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }) {
  return (
    <button
      {...props}
      className={cx(
        'inline-flex min-h-10 items-center justify-center rounded-md px-3 text-sm font-medium transition disabled:opacity-50',
        variant === 'primary' && 'bg-slate-900 text-white hover:bg-slate-700',
        variant === 'secondary' && 'border border-slate-300 bg-white hover:bg-slate-50',
        variant === 'danger' && 'border border-red-300 bg-white text-red-700 hover:bg-red-50',
        variant === 'ghost' && 'text-slate-600 hover:bg-slate-100',
        className,
      )}
    />
  );
}

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      {children}
      {hint && !error && <span className="text-xs text-slate-500">{hint}</span>}
      {error && <span className="text-xs text-red-700">{error}</span>}
    </label>
  );
}

const control =
  'min-h-10 rounded-md border border-slate-300 px-3 text-base sm:text-sm focus:border-slate-900 focus:outline-none';

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(control, props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(control, 'bg-white', props.className)} />;
}

export function Card({ title, actions, children }: { title?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      {(title || actions) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h1 className="text-xl font-semibold">{title}</h1>
      {actions}
    </div>
  );
}

export function ErrorBanner({ error }: { error: unknown }) {
  if (!error) return null;
  const message =
    error instanceof ApiError ? (error.problem.detail ?? error.problem.title) : 'Something went wrong. Try again.';
  return (
    <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
      {message}
    </div>
  );
}

export function Loading() {
  return <p className="p-6 text-sm text-slate-500">Loading…</p>;
}

export function Badge({
  children,
  tone = 'slate',
}: {
  children: ReactNode;
  tone?: 'slate' | 'green' | 'amber' | 'red';
}) {
  return (
    <span
      className={cx(
        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
        tone === 'slate' && 'bg-slate-100 text-slate-700',
        tone === 'green' && 'bg-green-100 text-green-800',
        tone === 'amber' && 'bg-amber-100 text-amber-800',
        tone === 'red' && 'bg-red-100 text-red-800',
      )}
    >
      {children}
    </span>
  );
}
