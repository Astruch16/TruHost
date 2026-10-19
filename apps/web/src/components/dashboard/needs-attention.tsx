import { Link } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import type { IconProps } from '../illustrations/defs';
import { InviteIcon } from '../illustrations/list-icons';
import { ExpensesIcon, FeeIcon, GrossIcon } from '../illustrations/statement-icons';
import { AllClearIllustration } from '../illustrations/all-clear';
import { Card } from '../ui/card';
import { EmptyState } from '../ui/empty-state';
import { Pill } from '../ui/pill';

export interface AttentionItem {
  kind: 'PAYOUT_MISSING' | 'RECEIPT_MISSING' | 'NO_PLAN' | 'INVITE_PENDING';
  id: string;
  propertyId: string | null;
  propertyName: string | null;
  title: string;
  detail: string;
  date: string | null;
}

const ICONS: Record<AttentionItem['kind'], (props: IconProps) => React.ReactElement> = {
  PAYOUT_MISSING: GrossIcon,
  RECEIPT_MISSING: ExpensesIcon,
  NO_PLAN: FeeIcon,
  INVITE_PENDING: InviteIcon,
};

function Target({ item, children }: { item: AttentionItem; children: React.ReactNode }) {
  const className =
    'group flex items-start gap-3 rounded-control px-2 py-3 -mx-2 transition-colors hover:bg-ground focus-visible:bg-ground';
  const month = item.date?.slice(0, 7);
  switch (item.kind) {
    case 'PAYOUT_MISSING':
      return (
        <Link to="/admin/bookings" search={{ month }} className={className}>
          {children}
        </Link>
      );
    case 'RECEIPT_MISSING':
      return (
        <Link to="/admin/expenses" search={{ month }} className={className}>
          {children}
        </Link>
      );
    case 'NO_PLAN':
      return (
        <Link to="/admin/properties/$propertyId" params={{ propertyId: item.id }} className={className}>
          {children}
        </Link>
      );
    case 'INVITE_PENDING':
      return (
        <Link to="/admin/team" className={className}>
          {children}
        </Link>
      );
  }
}

export function NeedsAttention({
  items,
  total,
  showProperty,
}: {
  items: AttentionItem[];
  total: number;
  showProperty: boolean;
}) {
  return (
    <Card title="Needs attention">
      {items.length === 0 ? (
        <EmptyState size="compact" illustration={<AllClearIllustration />} title="All clear">
          No missing payouts, receipts or plans. Anything that needs you will show up here.
        </EmptyState>
      ) : (
        <ul className="flex flex-col">
          {items.map((item) => {
            const Icon = ICONS[item.kind];
            return (
              <li key={`${item.kind}-${item.id}`}>
                <Target item={item}>
                  <Icon className="shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-ink">{item.title}</span>
                      {showProperty && item.propertyName && <Pill tone="blue">{item.propertyName}</Pill>}
                    </span>
                    <span className="mt-0.5 block text-sm text-muted">{item.detail}</span>
                  </span>
                  <ChevronRight aria-hidden className="mt-2 size-4 shrink-0 text-muted group-hover:text-ink" />
                </Target>
              </li>
            );
          })}
        </ul>
      )}
      {total > items.length && <p className="mt-2 text-sm text-muted">+{total - items.length} more</p>}
    </Card>
  );
}
