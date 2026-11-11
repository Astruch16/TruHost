import type { ReactElement, ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import { attentionGroups, type AttentionGroup, type AttentionItem } from '../../lib/attention';
import type { IconProps } from '../illustrations/defs';
import { InviteIcon } from '../illustrations/list-icons';
import { ExpensesIcon, FeeIcon, GrossIcon } from '../illustrations/statement-icons';
import { AllClearIllustration } from '../illustrations/all-clear';
import { Card } from '../ui/card';
import { EmptyState } from '../ui/empty-state';
import { Pill } from '../ui/pill';

const ICONS: Record<AttentionItem['kind'], (props: IconProps) => ReactElement> = {
  PAYOUT_MISSING: GrossIcon,
  RECEIPT_MISSING: ExpensesIcon,
  NO_PLAN: FeeIcon,
  INVITE_PENDING: InviteIcon,
};

const ROW =
  'group -mx-2 flex w-[calc(100%+1rem)] items-start gap-3 rounded-control px-2 py-3 text-left transition-colors hover:bg-ground focus-visible:bg-ground';

/** Where a row goes: payouts open the payout list; the rest go to the page where they're fixed. */
function Target({
  group,
  onEnterPayouts,
  children,
}: {
  group: AttentionGroup;
  onEnterPayouts?: () => void;
  children: ReactNode;
}) {
  const one = group.count === 1 ? group.items[0] : undefined;
  switch (group.kind) {
    case 'PAYOUT_MISSING':
      return onEnterPayouts ? (
        <button type="button" onClick={onEnterPayouts} className={ROW}>
          {children}
        </button>
      ) : (
        <Link to="/admin/bookings" search={{ month: group.items[0]?.date?.slice(0, 7) }} className={ROW}>
          {children}
        </Link>
      );
    case 'RECEIPT_MISSING':
      return (
        <Link to="/admin/expenses" search={{ month: one?.date?.slice(0, 7) }} className={ROW}>
          {children}
        </Link>
      );
    case 'NO_PLAN':
      return one ? (
        <Link to="/admin/properties/$propertyId" params={{ propertyId: one.id }} className={ROW}>
          {children}
        </Link>
      ) : (
        <Link to="/admin/properties" className={ROW}>
          {children}
        </Link>
      );
    case 'INVITE_PENDING':
      return (
        <Link to="/admin/team" className={ROW}>
          {children}
        </Link>
      );
  }
}

/**
 * What needs the admin, one row per kind: a single item reads as itself ("Receipt missing" with its detail); several
 * of a kind read as one ("3 stays waiting on payout") with the properties involved. Stays waiting on payout open a
 * list where every payout can be entered in one place (`onEnterPayouts`); the rest go to the page that fixes them.
 */
export function NeedsAttention({
  items,
  counts,
  showProperty,
  onEnterPayouts,
}: {
  items: AttentionItem[];
  /** How many of each kind there are (items lists at most ten of each). */
  counts: Record<AttentionItem['kind'], number>;
  showProperty: boolean;
  onEnterPayouts?: () => void;
}) {
  const groups = attentionGroups(items, counts);
  return (
    <Card title="Needs attention" tour="needs-attention">
      {groups.length === 0 ? (
        <EmptyState size="compact" illustration={<AllClearIllustration />} title="All clear">
          No missing payouts, receipts or plans. Anything that needs you will show up here.
        </EmptyState>
      ) : (
        <ul className="flex flex-col">
          {groups.map((group) => {
            const Icon = ICONS[group.kind];
            return (
              <li key={group.kind}>
                <Target group={group} onEnterPayouts={onEnterPayouts}>
                  <Icon className="shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-ink">{group.title}</span>
                      {showProperty &&
                        group.properties.map((name) => (
                          <Pill key={name} tone="blue">
                            {name}
                          </Pill>
                        ))}
                    </span>
                    <span className="mt-0.5 block text-sm text-muted">{group.detail}</span>
                  </span>
                  <ChevronRight aria-hidden className="mt-2 size-4 shrink-0 text-muted group-hover:text-ink" />
                </Target>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
