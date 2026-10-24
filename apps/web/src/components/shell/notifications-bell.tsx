import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@truhost/api-client';
import type { Me, Notification } from '@truhost/shared';
import { Bell, BellOff } from 'lucide-react';
import { propertyPath } from '../../lib/access';
import { usesOwnerPortal } from '../../lib/nav';
import { useApi } from '../../lib/api-context';
import { cx } from '../../lib/cx';
import { queries } from '../../lib/queries';
import { menuSurfaceStyles } from '../../lib/styles';
import { since } from '../../lib/supplies';
import { DamageAlertIcon } from '../illustrations/damage';
import { CleanDoneIcon, TimeOffIcon } from '../illustrations/list-icons';
import { SupplyAlertIcon } from '../illustrations/supplies';
import { ErrorAlert } from '../ui/alert';
import { Skeleton } from '../ui/skeleton';

/**
 * The bell, wired to the API: the caller's notifications (checked every minute). Opening one marks it read and goes
 * to its property. Only for people who can be notified (admins and owners); cleaners get none.
 */
export function LiveNotificationsBell({ me }: { me: Pick<Me, 'staffRole' | 'memberships'> }) {
  const api = useApi();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const query = queries.notifications(api);
  const list = useQuery(query);
  const markRead = useMutation({
    mutationFn: (body: { ids: string[] } | { all: true }) => unwrap(api.POST('/v1/me/notifications/read', { body })),
    onSuccess: (data) => qc.setQueryData(query.queryKey, data),
  });
  return (
    <NotificationsBell
      items={list.data?.items}
      unread={list.data?.unread ?? 0}
      error={list.error ?? markRead.error}
      onOpenItem={(n) => {
        if (!n.readAt) markRead.mutate({ ids: [n.id] });
        // Time off is about a cleaner, not a property: its page lists every request.
        if (n.kind === 'TIME_OFF_REQUESTED') {
          void navigate({ to: '/admin/time-off' });
          return;
        }
        // Owners open their portal: damage on its Damage page, supplies and finished cleans on Home.
        if (usesOwnerPortal(me)) {
          void navigate({ to: n.kind === 'DAMAGE_REPORTED' ? '/owner/damage' : '/owner' });
          return;
        }
        if (!n.property) return;
        const to = propertyPath(me, n.property.id);
        if (to) void navigate({ to, params: { propertyId: n.property.id } });
      }}
      onMarkAllRead={() => markRead.mutate({ all: true })}
      markingAll={markRead.isPending && 'all' in (markRead.variables ?? {})}
    />
  );
}

/** Bell with an unread dot and a list of recent notifications. Presentational: data and actions come in as props. */
export function NotificationsBell({
  items,
  unread = 0,
  error,
  onOpenItem,
  onMarkAllRead,
  markingAll = false,
}: {
  /** Undefined while loading. */
  items?: Notification[];
  unread?: number;
  error?: unknown;
  onOpenItem?: (n: Notification) => void;
  onMarkAllRead?: () => void;
  markingAll?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
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
            className="absolute top-1.5 right-1.5 grid h-4.5 min-w-4.5 place-items-center rounded-full border-2 border-ground bg-danger-mid px-1 text-[10px] leading-none font-bold text-white"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className={cx(menuSurfaceStyles, 'flex w-[min(24rem,calc(100vw-2rem))] flex-col p-0 focus:outline-none')}
        >
          <div className="flex items-center justify-between gap-3 border-b border-line-soft px-4 py-3">
            <p className="font-semibold text-ink">Notifications</p>
            {unread > 0 && onMarkAllRead && (
              <button
                type="button"
                onClick={onMarkAllRead}
                disabled={markingAll}
                className="rounded-sm text-sm font-medium text-blue-deep underline-offset-4 hover:underline disabled:opacity-60"
              >
                Mark all read
              </button>
            )}
          </div>
          {error ? (
            <div className="p-4">
              <ErrorAlert error={error} />
            </div>
          ) : !items ? (
            <div className="flex flex-col gap-3 p-4" role="status" aria-label="Loading notifications">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-muted">
              <BellOff aria-hidden className="size-5" />
              You’re all caught up.
            </div>
          ) : (
            <ul className="scroll-area max-h-[min(26rem,70dvh)] overflow-y-auto py-1">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onOpenItem?.(n);
                    }}
                    className={cx(
                      'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-ground',
                      !n.readAt && 'bg-blue-tint/25',
                    )}
                  >
                    {n.kind === 'DAMAGE_REPORTED' ? (
                      <DamageAlertIcon size={36} className="shrink-0" />
                    ) : n.kind === 'CLEAN_COMPLETED' ? (
                      <CleanDoneIcon size={36} className="shrink-0" />
                    ) : n.kind === 'TIME_OFF_REQUESTED' ? (
                      <TimeOffIcon size={36} className="shrink-0" />
                    ) : (
                      <SupplyAlertIcon out={n.kind === 'SUPPLY_OUT'} size={36} className="shrink-0" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className={cx('block text-sm text-ink', n.readAt ? 'font-medium' : 'font-semibold')}>
                        {n.title}
                      </span>
                      {n.body && <span className="block text-sm text-muted">{n.body}</span>}
                      <span className="mt-0.5 block text-xs text-muted">{since(new Date(n.createdAt))}</span>
                    </span>
                    {!n.readAt && (
                      <span aria-label="Unread" className="mt-1.5 size-2.5 shrink-0 rounded-full bg-blue-deep" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
