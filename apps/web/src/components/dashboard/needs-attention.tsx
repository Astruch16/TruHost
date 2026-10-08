import { Link } from '@tanstack/react-router';
import { Banknote, ChevronRight, MailWarning, ReceiptText, Shield, type LucideIcon } from 'lucide-react';
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

const ICONS: Record<AttentionItem['kind'], LucideIcon> = {
  PAYOUT_MISSING: Banknote,
  RECEIPT_MISSING: ReceiptText,
  NO_PLAN: Shield,
  INVITE_PENDING: MailWarning,
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
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-lavender-tint text-lavender-deep">
                    <Icon aria-hidden className="size-[18px]" />
                  </span>
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
