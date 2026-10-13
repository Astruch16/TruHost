import type { Property } from '@truhost/shared';
import { Clock, ExternalLink, MapPin } from 'lucide-react';
import { formatTime } from '../../lib/my-properties';
import { Card } from '../ui/card';

const LISTINGS = [
  ['airbnbUrl', 'Airbnb'],
  ['vrboUrl', 'Vrbo'],
  ['bookingComUrl', 'Booking.com'],
] as const;

/** Address (with a map link), stay times and the public listings. */
export function PropertyDetailsPanel({ property: p }: { property: Property }) {
  const address = [p.addressLine1, p.addressLine2, `${p.city}, ${p.province} ${p.postalCode}`].filter(Boolean);
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.join(', '))}`;
  const listings = LISTINGS.filter(([key]) => p[key]);
  return (
    <Card title="Details">
      <div className="flex flex-col gap-4 text-sm">
        <div className="flex gap-3">
          <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
          <div className="min-w-0">
            {address.map((line) => (
              <p key={line} className="text-ink">
                {line}
              </p>
            ))}
            <a
              href={maps}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1 font-semibold text-sage-deep hover:underline"
            >
              Open in Maps <ExternalLink aria-hidden className="size-3.5" />
            </a>
          </div>
        </div>
        <div className="flex gap-3">
          <Clock aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
          <p className="figure text-ink">
            Check-in {formatTime(p.checkInTime)} · Check-out {formatTime(p.checkOutTime)}
          </p>
        </div>
        {listings.length > 0 && (
          <div className="flex flex-wrap gap-2 border-t border-line-soft pt-4">
            {listings.map(([key, label]) => (
              <a
                key={key}
                href={p[key]!}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 font-medium text-ink transition-colors hover:border-ink/25 hover:bg-ground"
              >
                {label} <ExternalLink aria-hidden className="size-3.5 text-muted" />
              </a>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
