import { useState, type ReactNode } from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cx } from '../../lib/cx';
import { ErrorAlert } from './alert';
import { Button } from './button';

/**
 * Modal dialog on Radix (focus trap, Escape, scroll lock, aria wiring). Controlled via open/onOpenChange.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  // Once the body has scrolled, a hairline under the title shows where the content goes.
  const [scrolled, setScrolled] = useState(false);
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-ink/40 animate-fade-in" />
        <RadixDialog.Content
          className={cx(
            'fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden',
            'rounded-card border border-line-soft bg-surface shadow-xl animate-pop-in focus:outline-none',
            size === 'sm' && 'max-w-md',
            size === 'md' && 'max-w-lg',
            size === 'lg' && 'max-w-2xl',
            size === 'xl' && 'max-w-3xl',
          )}
          {...(description ? {} : { 'aria-describedby': undefined })}
        >
          {/* The title stays put; only the body scrolls, inside the card's rounded shape, with the portal's scrollbar. */}
          <div
            className={cx(
              'flex shrink-0 items-start justify-between gap-4 border-b px-6 pt-6 pb-4 transition-colors',
              scrolled ? 'border-line-soft' : 'border-transparent',
            )}
          >
            <div>
              <RadixDialog.Title className="text-lg font-semibold text-ink">{title}</RadixDialog.Title>
              {description && (
                <RadixDialog.Description className="mt-1 text-sm text-muted">{description}</RadixDialog.Description>
              )}
            </div>
            <RadixDialog.Close asChild>
              <Button variant="quiet" size="sm" aria-label="Close" className="-mt-1 -mr-2 px-2">
                <X aria-hidden className="size-4" />
              </Button>
            </RadixDialog.Close>
          </div>
          <div
            className="scroll-area min-h-0 flex-1 overflow-y-auto px-6 pb-6"
            onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 0)}
          >
            {children}
            {footer && <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div>}
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

/**
 * Replaces window.confirm for consequential actions: stays open while the action runs and shows its error.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = false,
  pending,
  error,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  pending: boolean;
  error: unknown;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !pending && onOpenChange(next)}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="secondary" disabled={pending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant={destructive ? 'danger-solid' : 'primary'} loading={pending} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <ErrorAlert error={error} />
    </Dialog>
  );
}
