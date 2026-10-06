import { formatBps } from '../../lib/format';
import { formatCents } from '../../lib/money';

/**
 * Where gross revenue went: net to owners, TruPlan fee, owner-borne expenses. Cleaning fees (TruHost revenue) are
 * shown separately. Bar widths are proportions of figures the API computed.
 */
export function RevenueBreakdown({
  breakdown,
  feeRatesBps,
}: {
  breakdown: {
    grossCents: number;
    managementFeeCents: number;
    ownerExpensesCents: number;
    netToOwnersCents: number;
    cleaningFeesCents: number;
  };
  feeRatesBps: number[];
}) {
  const net = Math.max(breakdown.netToOwnersCents, 0);
  const whole = Math.max(breakdown.grossCents, breakdown.managementFeeCents + breakdown.ownerExpensesCents + net, 1);
  const parts = [
    { key: 'net', label: 'Net to owners', cents: breakdown.netToOwnersCents, width: net, color: 'bg-primary' },
    {
      key: 'fee',
      label: feeRatesBps.length === 1 ? `TruPlan fee (${formatBps(feeRatesBps[0]!)})` : 'TruPlan fees',
      cents: breakdown.managementFeeCents,
      width: breakdown.managementFeeCents,
      color: 'bg-lavender-deep',
    },
    {
      key: 'exp',
      label: 'Owner-borne expenses',
      cents: breakdown.ownerExpensesCents,
      width: breakdown.ownerExpensesCents,
      color: 'bg-blue-deep',
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-muted">Gross revenue</span>
        <span className="figure text-xl font-bold text-ink">{formatCents(breakdown.grossCents)}</span>
      </div>
      <div
        role="img"
        aria-label={parts.map((p) => `${p.label} ${formatCents(p.cents)}`).join(', ')}
        className="flex h-3.5 gap-1 overflow-hidden rounded-full bg-line-soft"
      >
        {parts
          .filter((p) => p.width > 0)
          .map((p) => (
            <span key={p.key} className={`${p.color} rounded-full`} style={{ width: `${(p.width / whole) * 100}%` }} />
          ))}
      </div>
      <dl className="grid gap-4 sm:grid-cols-3">
        {parts.map((p) => (
          <div key={p.key}>
            <dt className="flex items-center gap-2 text-sm text-muted">
              <span aria-hidden className={`size-2.5 rounded-full ${p.color}`} />
              {p.label}
            </dt>
            <dd className="figure mt-1 text-lg font-bold text-ink">{formatCents(p.cents)}</dd>
          </div>
        ))}
      </dl>
      {breakdown.netToOwnersCents < 0 && (
        <p className="text-sm text-danger-deep">Expenses exceed revenue this month: owners would owe the difference.</p>
      )}
      <div className="flex items-center justify-between gap-3 rounded-inner bg-ground px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-ink">Cleaning fees collected</p>
          <p className="text-xs text-muted">TruHost revenue, not part of owner gross</p>
        </div>
        <span className="figure text-lg font-bold text-ink">{formatCents(breakdown.cleaningFeesCents)}</span>
      </div>
    </div>
  );
}
