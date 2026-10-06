import * as Popover from '@radix-ui/react-popover';
import { Bell, BellOff } from 'lucide-react';
import { cx } from '../../lib/cx';

/** Bell with an unread dot. Notifications arrive in Phase 3 (supply alerts); until then it shows an empty state. */
export function NotificationsBell({ unread = 0 }: { unread?: number }) {
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        className={cx(
          'relative grid size-11 place-items-center rounded-full text-ink transition-colors hover:bg-ink/5',
          'data-[state=open]:bg-ink/5',
        )}
      >
        <Bell aria-hidden className="size-5" strokeWidth={1.75} />
        {unread > 0 && (
          <span
            aria-hidden
            className="absolute top-2.5 right-2.5 size-2.5 rounded-full border-2 border-ground bg-lavender-deep"
          />
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-50 w-[min(20rem,calc(100vw-2rem))] rounded-inner border border-line bg-surface p-4 shadow-xl animate-pop-in focus:outline-none"
        >
          <p className="mb-3 font-semibold text-ink">Notifications</p>
          <div className="flex flex-col items-center gap-2 py-4 text-center text-sm text-muted">
            <BellOff aria-hidden className="size-5" />
            You’re all caught up.
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
