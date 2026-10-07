import { Link } from '@tanstack/react-router';
import { cx } from '../../lib/cx';
import { monogram, TINTS } from '../../lib/dashboard-format';
import { formatOccupancy } from '../../lib/format';
import { formatCents } from '../../lib/money';
import { Pill } from '../ui/pill';

/** Property performance card. The tinted monogram tile stands in for the cover photo until file storage has one. */
export function PropertyCard({
  property,
  index,
  revenueLabel,
}: {
  property: {
    id: string;
    name: string;
    city: string;
    province: string;
    archived: boolean;
    hasPlan: boolean;
    occupancyBps: number | null;
    grossCents: number;
  };
  index: number;
  revenueLabel: string;
}) {
  const tint = TINTS[index % TINTS.length]!;
  return (
    <Link
      to="/admin/properties/$propertyId"
      params={{ propertyId: property.id }}
      className="group flex flex-col overflow-hidden rounded-inner border border-line bg-surface transition-[border-color,box-shadow] hover:border-ink/25 hover:shadow-sm"
    >
      <div aria-hidden className={cx('grid h-28 place-items-center', tint.bg)}>
        <span className={cx('text-4xl font-bold tracking-tight', tint.fg)}>{monogram(property.name)}</span>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{property.name}</p>
            <p className="truncate text-sm text-muted">
              {property.city}, {property.province}
            </p>
          </div>
          {property.archived ? (
            <Pill tone="neutral">Archived</Pill>
          ) : property.hasPlan ? (
            <Pill tone="sage">Active</Pill>
          ) : (
            <Pill tone="lavender">No plan</Pill>
          )}
        </div>
        <dl className="mt-auto grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="text-xs text-muted">Occupancy</dt>
            <dd className="figure text-lg font-bold text-ink">{formatOccupancy(property.occupancyBps)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">{revenueLabel}</dt>
            <dd className="figure text-lg font-bold text-ink">{formatCents(property.grossCents)}</dd>
          </div>
        </dl>
      </div>
    </Link>
  );
}
