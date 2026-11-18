import { Link } from '@tanstack/react-router';
import { ArrowRight, BedDouble, ExternalLink, KeyRound, MapPin, Pencil, Sparkles } from 'lucide-react';
import { cx } from '../../lib/cx';
import { TINTS } from '../../lib/dashboard-format';
import { formatTime, propertyFacts, type MyProperty } from '../../lib/my-properties';
import { buttonStyles } from '../../lib/styles';
import { CoverImage } from '../cover-image';
import { PropertyScene } from '../illustrations/property-scene';
import { Pill } from '../ui/pill';

/** The photo (or drawn scene) fills its side and zooms in a touch when hovered. */
const COVER = 'absolute inset-0 size-full transition-transform duration-700 group-hover/photo:scale-[1.03]';
const LABEL = 'text-[11px] font-bold tracking-[0.1em] text-muted uppercase';

/**
 * A property given room of its own, for someone with one or two (My properties): a large photo beside its address and
 * description, check-in, check-out and sleeps as figures, its layout, the sites it's listed on, and a way in (plus
 * Edit for admins). Stacks on narrow screens. Opens the owner page or the cleaner page, by the person's role on it.
 */
export function MyPropertyFeature({ item, onEdit }: { item: MyProperty; onEdit?: () => void }) {
  const { property: p, role, index } = item;
  const owner = role === 'OWNER';
  const tint = TINTS[index % TINTS.length]!;
  // Sleeps is one of the figures, so the layout pills are just rooms.
  const layout = propertyFacts({ ...p, maxGuests: null });
  const figures = [
    { label: 'Check-in', value: formatTime(p.checkInTime) },
    { label: 'Check-out', value: formatTime(p.checkOutTime) },
    ...(p.maxGuests !== null ? [{ label: 'Sleeps', value: String(p.maxGuests) }] : []),
  ];
  const listings = [
    { name: 'Airbnb', url: p.airbnbUrl },
    { name: 'Vrbo', url: p.vrboUrl },
    { name: 'Booking.com', url: p.bookingComUrl },
  ].flatMap((l) => (l.url ? [{ name: l.name, url: l.url }] : []));
  const link = {
    to: owner ? ('/properties/$propertyId' as const) : ('/cleaner/properties/$propertyId' as const),
    params: { propertyId: p.id },
  };

  return (
    <article className="grid overflow-hidden rounded-card border border-line-soft bg-surface @3xl/content:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      {/* The photo opens the property too, for the mouse; keyboards and screen readers use the button. */}
      <Link
        {...link}
        tabIndex={-1}
        aria-hidden
        className={cx(
          'group/photo relative block aspect-[16/10] overflow-hidden @3xl/content:aspect-auto @3xl/content:min-h-[22rem]',
          tint.bg,
        )}
      >
        <CoverImage
          url={p.coverPhoto?.url}
          alt=""
          className={COVER}
          fallback={<PropertyScene index={index} className={COVER} />}
        />
        <Pill
          tone={owner ? 'sage' : 'lavender'}
          icon={owner ? <KeyRound /> : <Sparkles />}
          className="absolute top-4 left-4 shadow-sm"
        >
          {owner ? 'You own this' : 'You clean here'}
        </Pill>
      </Link>

      <div className="flex flex-col gap-6 p-5 @2xl/content:p-6 @[100rem]/content:p-8">
        <div>
          <h2 className="font-display text-[1.75rem] leading-tight font-semibold tracking-[-0.01em] text-ink @2xl/content:text-[1.875rem]">
            {p.name}
          </h2>
          <p className="mt-1.5 flex items-start gap-1.5 text-sm text-muted">
            <MapPin aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>
              {p.addressLine1}
              {p.addressLine2 && `, ${p.addressLine2}`}, {p.city}, {p.province}
            </span>
          </p>
          {p.description && <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-ink/80">{p.description}</p>}
        </div>

        <dl className="grid grid-cols-3 gap-2">
          {figures.map(({ label, value }) => (
            <div key={label} className="min-w-0 rounded-inner bg-ground px-2.5 py-3 @md/content:px-3">
              {/* Tighter on a phone, so "Check-out" fits its tile. */}
              <dt className={cx(LABEL, 'truncate tracking-[0.04em] @md/content:tracking-[0.1em]')}>{label}</dt>
              <dd className="figure mt-1 text-lg font-semibold whitespace-nowrap text-ink @2xl/content:text-xl">
                {value}
              </dd>
            </div>
          ))}
        </dl>

        {layout.length > 0 && (
          <ul aria-label="Layout" className="flex flex-wrap items-center gap-1.5">
            <BedDouble aria-hidden className="mr-0.5 size-4 text-muted" />
            {layout.map((f) => (
              <li key={f}>
                <Pill dot={false}>{f}</Pill>
              </li>
            ))}
          </ul>
        )}

        <div className="text-sm">
          <p className={LABEL}>Listed on</p>
          {listings.length > 0 ? (
            <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
              {listings.map((l) => (
                <li key={l.name}>
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-primary link-underline"
                  >
                    {l.name} <ExternalLink aria-hidden className="size-3.5" />
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1.5 text-muted">No listings linked yet.</p>
          )}
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-line-soft pt-5">
          <Link {...link} className={buttonStyles()}>
            {owner ? 'Open property' : 'Open'}
            <span className="sr-only">: {p.name}</span>
            <ArrowRight aria-hidden className="size-4" />
          </Link>
          {onEdit && (
            <button type="button" onClick={onEdit} className={buttonStyles({ variant: 'secondary' })}>
              <Pencil aria-hidden className="size-4" /> Edit details <span className="sr-only">for {p.name}</span>
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
