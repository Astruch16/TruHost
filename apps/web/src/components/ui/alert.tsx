import type { ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { ApiError } from '@truhost/api-client';

/** Inline error message for a failed request. Renders nothing when `error` is falsy. */
export function ErrorAlert({ error, action }: { error: unknown; action?: ReactNode }) {
  if (!error) return null;
  const message =
    error instanceof ApiError
      ? (error.problem.detail ?? error.problem.title)
      : error instanceof Error && error.name === 'UploadError'
        ? error.message
        : 'Something went wrong. Please try again.';
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-inner border border-danger-line bg-danger-tint px-3.5 py-3 text-sm text-danger-deep"
    >
      <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      <p className="flex-1">{message}</p>
      {action}
    </div>
  );
}
