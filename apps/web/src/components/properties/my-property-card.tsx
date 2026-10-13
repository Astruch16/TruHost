import { Link } from '@tanstack/react-router';
import { ArrowRight, Clock, KeyRound, MapPin, Sparkles } from 'lucide-react';
import { cx } from '../../lib/cx';
import { monogram, TINTS } from '../../lib/dashboard-format';
import { formatTime, propertyFacts, type MyProperty } from '../../lib/my-properties';
import { CoverImage } from '../cover-image';

/**
 * A property on the owner/cleaner landing page: its cover photo (or tinted initials), role, place, layout and stay
 * times. Opens the owner page or the cleaner page, by the person's role on it.
 */
export function MyPropertyCard({ item }: { item: MyProperty }) {
  const { property: p, role, index } = item;
  const tint = TINTS[index % TINTS.length]!;
  const facts = propertyFacts(p);
  const owner = role === 'OWNER';
  return (
    <Link
      to={owner ? '/properties/$propertyId' : '/cleaner/properties/$propertyId'}
      params={{ propertyId: p.id }}
      className={cx(
        'group flex h-full flex-col overflow-hidden rounded-card border border-line-soft bg-surface',
        'transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-line hover:shadow-[0_18px_40px_-24px_rgba(26,29,33,0.45)]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-deep',
      )}
    >
      <div className={cx('relative aspect-[16/10] overflow-hidden', tint.bg)}>
        <CoverImage
          url={p.coverPhoto?.thumbUrl}
          alt=""
          className="size-full transition-transform duration-500 group-hover:scale-[1.03]"
          fallback={
            <span aria-hidden className="grid size-full place-items-center">
              <span className={cx('text-5xl font-bold tracking-tight', tint.fg)}>{monogram(p.name)}</span>
            </span>
          }
        />
        <span
          className={cx(
            'absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm backdrop-blur',
            owner ? 'bg-white/90 text-sage-deep' : 'bg-white/90 text-lavender-deep',
          )}
        >
          {owner ? <KeyRound aria-hidden className="size-3.5" /> : <Sparkles aria-hidden className="size-3.5" />}
          {owner ? 'You own this' : 'You clean here'}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-ink">{p.name}</h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
            <MapPin aria-hidden className="size-3.5 shrink-0" />
            <span className="truncate">
              {p.city}, {p.province}
            </span>
          </p>
        </div>
        {facts.length > 0 && (
          <ul aria-label="Layout" className="flex flex-wrap gap-1.5">
            {facts.map((f) => (
              <li key={f} className="rounded-full bg-ground px-2.5 py-1 text-xs font-medium text-ink">
                {f}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-line-soft pt-3 text-sm">
          <span className="flex min-w-0 items-center gap-1.5 text-muted">
            <Clock aria-hidden className="size-3.5 shrink-0" />
            <span className="figure truncate">
              In {formatTime(p.checkInTime)} · Out {formatTime(p.checkOutTime)}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1 font-semibold text-sage-deep">
            {owner ? 'View' : 'Open'}
            <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}

/** Placeholder while the list loads, the same shape as a card. */
export function MyPropertyCardSkeleton() {
  return (
    <div aria-hidden className="flex flex-col overflow-hidden rounded-card border border-line-soft bg-surface">
      <div className="aspect-[16/10] animate-skeleton bg-line-soft" />
      <div className="flex flex-col gap-3 p-5">
        <div className="h-5 w-2/3 animate-skeleton rounded bg-line-soft" />
        <div className="h-4 w-1/3 animate-skeleton rounded bg-line-soft" />
        <div className="h-6 w-1/2 animate-skeleton rounded-full bg-line-soft" />
      </div>
    </div>
  );
}
