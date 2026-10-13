import type { ReactNode } from 'react';
import type { Property } from '@truhost/shared';
import { Clock, KeyRound, MapPin, Sparkles } from 'lucide-react';
import { cx } from '../../lib/cx';
import { monogram, TINTS } from '../../lib/dashboard-format';
import { formatTime, propertyFacts } from '../../lib/my-properties';
import { CoverImage } from '../cover-image';

/**
 * The top of a property page: its cover photo as a wide banner (or its tinted initials), with the name, town, role,
 * layout and stay times over it. `actions` sit top right (e.g. Edit for admins).
 */
export function PropertyHero({
  property: p,
  index,
  role,
  actions,
}: {
  property: Property;
  /** For the tint when there's no photo (matches the switcher and the cards). */
  index: number;
  role: 'OWNER' | 'CLEANER';
  actions?: ReactNode;
}) {
  const tint = TINTS[index % TINTS.length]!;
  const facts = propertyFacts(p);
  const photo = Boolean(p.coverPhoto);
  return (
    <section
      aria-label={p.name}
      className={cx('relative isolate overflow-hidden rounded-card', photo ? 'bg-ink' : tint.bg)}
    >
      <div className="absolute inset-0 -z-10">
        <CoverImage
          url={p.coverPhoto?.url}
          alt=""
          eager
          className="size-full"
          fallback={
            <span aria-hidden className="grid size-full place-items-center">
              <span className={cx('text-[9rem] leading-none font-bold tracking-tight opacity-25', tint.fg)}>
                {monogram(p.name)}
              </span>
            </span>
          }
        />
        {photo && <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/25 to-ink/5" />}
      </div>
      <div className="flex min-h-64 flex-col justify-between gap-6 p-5 @2xl/content:min-h-80 @2xl/content:p-7">
        <div className="flex items-start justify-between gap-3">
          <span
            className={cx(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold shadow-sm backdrop-blur',
              'bg-white/90',
              role === 'OWNER' ? 'text-sage-deep' : 'text-lavender-deep',
            )}
          >
            {role === 'OWNER' ? (
              <KeyRound aria-hidden className="size-3.5" />
            ) : (
              <Sparkles aria-hidden className="size-3.5" />
            )}
            {role === 'OWNER' ? 'You own this' : 'You clean here'}
          </span>
          {actions && <div className="flex flex-wrap justify-end gap-2">{actions}</div>}
        </div>
        <div className={photo ? 'text-white' : 'text-ink'}>
          <h1 className="text-3xl font-bold tracking-tight @2xl/content:text-4xl">{p.name}</h1>
          <p className={cx('mt-1 flex items-center gap-1.5', photo ? 'text-white/85' : 'text-muted')}>
            <MapPin aria-hidden className="size-4" /> {p.city}, {p.province}
          </p>
          <ul aria-label="About this property" className="mt-4 flex flex-wrap gap-2">
            {facts.map((f) => (
              <Fact key={f} photo={photo}>
                {f}
              </Fact>
            ))}
            <Fact photo={photo}>
              <Clock aria-hidden className="size-3.5" /> In {formatTime(p.checkInTime)} · Out{' '}
              {formatTime(p.checkOutTime)}
            </Fact>
          </ul>
        </div>
      </div>
    </section>
  );
}

function Fact({ photo, children }: { photo: boolean; children: ReactNode }) {
  return (
    <li
      className={cx(
        'figure inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium',
        photo ? 'bg-white/15 text-white ring-1 ring-white/25 backdrop-blur' : 'bg-surface/80 text-ink',
      )}
    >
      {children}
    </li>
  );
}
