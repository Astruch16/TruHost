import { Link } from '@tanstack/react-router';
import type { OwnerHome } from '@truhost/shared';
import { FileText } from 'lucide-react';
import { cx } from '../../lib/cx';
import { categoryLabel } from '../../lib/format';
import { shortDate } from '../../lib/months';
import { monthOnly } from '../../lib/owner';
import { formatSigned } from '../../lib/statements';
import { ExpenseCategoryIcon } from '../illustrations/category-icons';
import { AdjustmentIcon } from '../illustrations/statement-icons';
import { Card } from '../ui/card';

type Item = OwnerHome['goodToKnow'][number];

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
  const tone = expense ? 'text-ink/75' : g.amountCents > 0 ? 'text-sage-deep' : 'text-danger-deep';
  const kind = expense ? categoryLabel(g.category ?? 'OTHER') : g.amountCents > 0 ? 'Credit' : 'Charge';
  const source = expense ? g.vendor : g.statementMonth && `${monthOnly(g.statementMonth)} statement`;
  return (
    <li className="px-2 py-3.5 first:pt-1 last:pb-1">
      {/* Top-aligned: the icon's top lines up with the top of the title's letters (the nudge allows for the
          title's line height), and the amount sits level with the title. */}
      <div className="flex items-start gap-3">
        {expense ? (
          <ExpenseCategoryIcon category={g.category} className="mt-1 shrink-0" />
        ) : (
          <AdjustmentIcon className="mt-1 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <p className="leading-snug font-medium text-ink">{g.title}</p>
          <p className="mt-0.5 text-xs text-muted">
            <span className={cx('font-semibold', tone)}>{kind}</span>
            {source && ` · ${source}`}
          </p>
          {/* With several properties, which one it was, on its own line (so names never break mid-line). */}
          {showProperty && <p className="text-xs text-muted">{g.property.name}</p>}
        </div>
        <div className="shrink-0 text-right">
          <p className={cx('figure leading-snug font-semibold', g.amountCents > 0 ? 'text-sage-deep' : 'text-ink')}>
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
