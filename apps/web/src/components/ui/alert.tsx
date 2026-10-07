import type { ReactNode } from 'react';
import { CircleAlert, RotateCw } from 'lucide-react';
import { userMessage } from '../../lib/errors';
import { Button } from './button';

/** Inline error for a failed action (form submit, button). Renders nothing when `error` is falsy. */
export function ErrorAlert({ error, action }: { error: unknown; action?: ReactNode }) {
  if (!error) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-inner border border-danger-line bg-danger-tint px-3.5 py-3 text-sm text-danger-deep"
    >
      <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      <p className="flex-1">{userMessage(error)}</p>
      {action}
    </div>
  );
}

/**
 * A section whose data failed to load: a plain message and a Retry button. Use it instead of leaving skeletons up.
 */
export function LoadError({
  what,
  onRetry,
  retrying = false,
}: {
  /** e.g. "the dashboard". */
  what: string;
  onRetry: () => void;
  retrying?: boolean;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-inner border border-danger-line bg-danger-tint px-5 py-8 text-center"
    >
      <CircleAlert aria-hidden className="size-5 text-danger-deep" />
      <div>
        <p className="font-semibold text-danger-deep">We couldn’t load {what}.</p>
        <p className="mt-1 text-sm text-danger-deep/80">Check your connection, then try again.</p>
      </div>
      <Button variant="secondary" size="sm" onClick={onRetry} loading={retrying}>
        <RotateCw aria-hidden className="size-4" /> Retry
      </Button>
    </div>
  );
}
