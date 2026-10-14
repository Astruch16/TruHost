import { Link } from '@tanstack/react-router';
import { Pencil } from 'lucide-react';
import { cx } from '../lib/cx';
import { monogram, TINTS } from '../lib/dashboard-format';
import { formatOccupancy } from '../lib/format';
import { formatCents } from '../lib/money';
import { CoverImage } from './cover-image';
import { Pill } from './ui/pill';
import { Skeleton } from './ui/skeleton';

/**
 * Property card with its cover photo (or a tinted monogram without one), status and the month's figures. Used on
 * the dashboard and the admin properties page. `wide` is for a card that has a row to itself (the dashboard with one
 * property): once it's wide enough, the photo sits beside the details, with occupancy as a bar and nights booked too.
 */
export function PropertyCard({
  property,
  index,
  revenueLabel,
  figures,
  onEdit,
  wide = false,
}: {
  property: {
    id: string;
    name: string;
    /** Second line, e.g. "Chilliwack, BC" or the street address. */
    location: string;
    archived: boolean;
    /** Null while unknown (figures still loading). */
    hasPlan: boolean | null;
    photoUrl: string | null;
  };
  index: number;
  revenueLabel: string;
  /** The month's figures from the reporting module; `'loading'` shows placeholders, null shows dashes. */
  figures: { occupancyBps: number | null; grossCents: number; nightsBooked?: number } | 'loading' | null;
  /** Shows an Edit button on the photo (the properties page). */
  onEdit?: () => void;
  wide?: boolean;
}) {
  const tint = TINTS[index % TINTS.length]!;
  const figure = (value: string) =>
    figures === 'loading' ? <Skeleton className="mt-1 h-6 w-16" /> : <span className="figure">{value}</span>;
  const known = figures && figures !== 'loading' ? figures : null;
  const card = (
    <Link
      to="/admin/properties/$propertyId"
      params={{ propertyId: property.id }}
      className={cx(
        'group flex h-full flex-col overflow-hidden rounded-inner border border-line bg-surface transition-[border-color,box-shadow] hover:border-ink/25 hover:shadow-sm',
        wide && '@[34rem]/card:flex-row',
      )}
    >
      <div
        className={cx(
          'relative aspect-[16/9] overflow-hidden',
          wide && '@[34rem]/card:aspect-auto @[34rem]/card:min-h-56 @[34rem]/card:w-[45%] @[34rem]/card:shrink-0',
          tint.bg,
        )}
      >
        <CoverImage
          url={property.photoUrl}
          alt=""
          className="size-full transition-transform duration-300 group-hover:scale-[1.02]"
          fallback={
            <span aria-hidden className="grid size-full place-items-center">
              <span className={cx('text-4xl font-bold tracking-tight', tint.fg)}>{monogram(property.name)}</span>
            </span>
          }
        />
      </div>
      <div className={cx('flex flex-1 flex-col gap-3 p-4', wide && '@[34rem]/card:gap-5 @[34rem]/card:p-6')}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={cx('truncate font-semibold text-ink', wide && '@[34rem]/card:text-xl')}>{property.name}</p>
            <p className="truncate text-sm text-muted">{property.location}</p>
          </div>
          {property.archived ? (
            <Pill tone="neutral">Archived</Pill>
          ) : property.hasPlan === false ? (
            <Pill tone="lavender">No plan</Pill>
          ) : (
            <Pill tone="sage">Active</Pill>
          )}
        </div>
        <dl
          className={cx(
            'mt-auto grid grid-cols-2 gap-2 text-sm',
            wide && known?.nightsBooked !== undefined && '@[34rem]/card:grid-cols-3 @[34rem]/card:gap-4',
          )}
        >
          <div>
            <dt className="text-xs text-muted">Occupancy</dt>
            <dd className={cx('text-lg font-bold text-ink', wide && '@[34rem]/card:text-2xl')}>
              {figure(known ? formatOccupancy(known.occupancyBps) : '—')}
            </dd>
            {wide && known && known.occupancyBps !== null && (
              // Same figure as a bar, where the card has the room.
              <span
                aria-hidden
                className="mt-2 hidden h-1.5 overflow-hidden rounded-full bg-line-soft @[34rem]/card:block"
              >
                <span
                  className="block h-full rounded-full bg-sage-mid"
                  style={{ width: `${Math.min(100, known.occupancyBps / 100)}%` }}
                />
              </span>
            )}
          </div>
          {wide && known?.nightsBooked !== undefined && (
            <div className="hidden @[34rem]/card:block">
              <dt className="text-xs text-muted">Nights booked</dt>
              <dd className="text-lg font-bold text-ink @[34rem]/card:text-2xl">
                <span className="figure">{known.nightsBooked}</span>
              </dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-muted">{revenueLabel}</dt>
            <dd className={cx('text-lg font-bold text-ink', wide && '@[34rem]/card:text-2xl')}>
              {figure(known ? formatCents(known.grossCents) : '—')}
            </dd>
          </div>
        </dl>
      </div>
    </Link>
  );
  // A wide card lays out against its own width, so the container is a wrapper (an element can't query itself).
  if (!onEdit) return wide ? <div className="@container/card h-full">{card}</div> : card;
  // The button sits beside the link (not inside it) so each is its own control.
  return (
    <div className="group/card relative h-full">
      {card}
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${property.name}`}
        className="absolute top-2.5 right-2.5 z-10 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-ink shadow-sm backdrop-blur-sm transition-[opacity,background-color] hover:bg-white focus-visible:opacity-100 sm:opacity-0 sm:group-hover/card:opacity-100 sm:focus-visible:opacity-100"
      >
        <Pencil aria-hidden className="size-3.5" /> Edit
      </button>
    </div>
  );
}
