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
const CATEGORY: Record<string, { icon: LucideIcon; bg: string; fg: string }> = {
  SUPPLIES: { icon: Package, bg: 'bg-amber-tint', fg: 'text-amber-deep' },
  REPAIRS_MAINTENANCE: { icon: Wrench, bg: 'bg-blue-tint', fg: 'text-blue-deep' },
  SUBSCRIPTIONS: { icon: Tv, bg: 'bg-lavender-tint', fg: 'text-lavender-deep' },
  UTILITIES: { icon: Zap, bg: 'bg-amber-tint', fg: 'text-amber-deep' },
  INTERNET: { icon: Wifi, bg: 'bg-blue-tint', fg: 'text-blue-deep' },
  FURNISHINGS: { icon: Sofa, bg: 'bg-sage-tint', fg: 'text-sage-deep' },
  CLEANING: { icon: Sparkles, bg: 'bg-sage-tint', fg: 'text-sage-deep' },
  LICENSING_PERMITS: { icon: FileBadge, bg: 'bg-lavender-tint', fg: 'text-lavender-deep' },
  INSURANCE: { icon: ShieldCheck, bg: 'bg-blue-tint', fg: 'text-blue-deep' },
  STRATA: { icon: Building2, bg: 'bg-line-soft', fg: 'text-ink' },
  OTHER: { icon: Receipt, bg: 'bg-line-soft', fg: 'text-ink' },
};

/** The receipt or statement link under an item, lined up with its title (past the 40px icon and 12px gap). */
const action =
  'inline-flex items-center gap-1 rounded-control-sm text-xs font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-blue-deep';

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
      ? { icon: ArrowDownLeft, bg: 'bg-sage-tint', fg: 'text-sage-deep' }
      : { icon: ArrowUpRight, bg: 'bg-danger-tint', fg: 'text-danger-deep' };
  const Icon = look.icon;
  const kind = expense ? categoryLabel(g.category ?? 'OTHER') : g.amountCents > 0 ? 'Credit' : 'Charge';
  const source = expense ? g.vendor : g.statementMonth && `${monthOnly(g.statementMonth)} statement`;
  return (
    <li className="px-2 py-3.5 first:pt-1 last:pb-1">
      {/* The icon sits centred beside the title and its details line. */}
      <div className="flex items-center gap-3">
        <span aria-hidden className={cx('grid size-10 shrink-0 place-items-center rounded-xl', look.bg, look.fg)}>
          <Icon className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink">{g.title}</p>
          <p className="mt-0.5 text-xs text-muted">
            <span className={cx('font-semibold', look.fg)}>{kind}</span>
            {source && ` · ${source}`}
          </p>
          {/* With several properties, which one it was, on its own line (so names never break mid-line). */}
          {showProperty && <p className="text-xs text-muted">{g.property.name}</p>}
        </div>
        <div className="shrink-0 self-center text-right">
          <p className={cx('figure font-semibold', g.amountCents > 0 ? 'text-sage-deep' : 'text-ink')}>
            {formatSigned(g.amountCents)}
          </p>
          <p className="mt-0.5 text-xs text-muted">{shortDate(g.date)}</p>
        </div>
      </div>
      {(g.receiptFileId || g.statementId) && (
        <div className="mt-1.5 flex flex-wrap gap-x-4 pl-[52px]">
          {g.receiptFileId && (
            <button type="button" onClick={() => onViewReceipt(g.receiptFileId!)} className={action}>
              <FileText aria-hidden className="size-3.5" /> View receipt
            </button>
          )}
          {g.statementId && (
            <Link to="/owner/statements/$statementId" params={{ statementId: g.statementId }} className={action}>
              <FileText aria-hidden className="size-3.5" /> View statement
            </Link>
          )}
        </div>
      )}
    </li>
  );
}
