import { Link } from '@tanstack/react-router';
import type { OwnerHome } from '@truhost/shared';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  FileBadge,
  FileText,
  Package,
  Receipt,
  ShieldCheck,
  Sofa,
  Sparkles,
  Tv,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { cx } from '../../lib/cx';
import { categoryLabel } from '../../lib/format';
import { shortDate } from '../../lib/months';
import { monthOnly } from '../../lib/owner';
import { formatSigned } from '../../lib/statements';
import { Card } from '../ui/card';

type Item = OwnerHome['goodToKnow'][number];

/** Each expense category's icon and tint, so a glance tells a restock from a repair. */
const CATEGORY: Record<string, { icon: LucideIcon; tint: string }> = {
  SUPPLIES: { icon: Package, tint: 'bg-amber-tint text-amber-deep' },
  REPAIRS_MAINTENANCE: { icon: Wrench, tint: 'bg-blue-tint text-blue-deep' },
  SUBSCRIPTIONS: { icon: Tv, tint: 'bg-lavender-tint text-lavender-deep' },
  UTILITIES: { icon: Zap, tint: 'bg-amber-tint text-amber-deep' },
  INTERNET: { icon: Wifi, tint: 'bg-blue-tint text-blue-deep' },
  FURNISHINGS: { icon: Sofa, tint: 'bg-sage-tint text-sage-deep' },
  CLEANING: { icon: Sparkles, tint: 'bg-sage-tint text-sage-deep' },
  LICENSING_PERMITS: { icon: FileBadge, tint: 'bg-lavender-tint text-lavender-deep' },
  INSURANCE: { icon: ShieldCheck, tint: 'bg-blue-tint text-blue-deep' },
  STRATA: { icon: Building2, tint: 'bg-line-soft text-ink' },
  OTHER: { icon: Receipt, tint: 'bg-line-soft text-ink' },
};

const chip =
  'inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-ink transition-colors hover:bg-ground focus-visible:outline-2 focus-visible:outline-blue-deep';

/**
 * Recent owner-paid expenses and adjustments on released statements: each with an icon for what it was, the date
 * beside the amount, and its receipt or statement one tap away. Hidden by the page when there's nothing to show.
 */
export function GoodToKnowCard({
  items,
  showProperty,
  onViewReceipt,
}: {
  items: OwnerHome['goodToKnow'];
  showProperty: boolean;
  onViewReceipt: (fileId: string) => void;
}) {
  return (
    <Card title="Good to know" description="Paid from your earnings lately, and corrections on your statements">
      <ul className="-mx-2 flex flex-col divide-y divide-line-soft">
        {items.map((g) => (
          <GoodToKnowItem key={g.id} item={g} showProperty={showProperty} onViewReceipt={onViewReceipt} />
        ))}
      </ul>
    </Card>
  );
}

function GoodToKnowItem({
  item: g,
  showProperty,
  onViewReceipt,
}: {
  item: Item;
  showProperty: boolean;
  onViewReceipt: (fileId: string) => void;
}) {
  const expense = g.kind === 'EXPENSE';
  const look = expense
    ? (CATEGORY[g.category ?? 'OTHER'] ?? CATEGORY.OTHER!)
    : g.amountCents > 0
      ? { icon: ArrowDownLeft, tint: 'bg-sage-tint text-sage-deep' }
      : { icon: ArrowUpRight, tint: 'bg-danger-tint text-danger-deep' };
  const Icon = look.icon;
  const where = [
    expense ? g.vendor : g.statementMonth && `${monthOnly(g.statementMonth)} statement`,
    showProperty ? g.property.name : null,
  ].filter(Boolean);
  return (
    <li className="flex gap-3 px-2 py-3.5 first:pt-1 last:pb-1">
      <span aria-hidden className={cx('grid size-10 shrink-0 place-items-center rounded-xl', look.tint)}>
        <Icon className="size-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 font-medium text-ink">{g.title}</p>
          <p className="shrink-0 text-right">
            <span className={cx('figure block font-semibold', g.amountCents > 0 ? 'text-sage-deep' : 'text-ink')}>
              {formatSigned(g.amountCents)}
            </span>
            <span className="block text-xs text-muted">{shortDate(g.date)}</span>
          </p>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-muted">
          <span
            className={cx(
              'rounded-full px-2 py-0.5 font-semibold',
              expense
                ? look.tint
                : g.amountCents > 0
                  ? 'bg-sage-tint text-sage-deep'
                  : 'bg-danger-tint text-danger-deep',
            )}
          >
            {expense ? categoryLabel(g.category ?? 'OTHER') : g.amountCents > 0 ? 'Credit' : 'Charge'}
          </span>
          {where.length > 0 && <span className="min-w-0 truncate">{where.join(' · ')}</span>}
        </div>
        {(g.receiptFileId || g.statementId) && (
          <div className="mt-2 flex flex-wrap gap-2">
            {g.receiptFileId && (
              <button type="button" onClick={() => onViewReceipt(g.receiptFileId!)} className={chip}>
                <FileText aria-hidden className="size-3.5 text-muted" /> Receipt
              </button>
            )}
            {g.statementId && (
              <Link to="/owner/statements/$statementId" params={{ statementId: g.statementId }} className={chip}>
                <FileText aria-hidden className="size-3.5 text-muted" /> Statement
              </Link>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
