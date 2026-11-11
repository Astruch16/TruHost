import type { Property } from '@truhost/shared';
import { BedDouble, Clock, FileBadge, Globe, MapPin, Percent, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatBps } from '../lib/format';
import { formatTime, propertyFacts } from '../lib/my-properties';

/**
 * A property's details for a card that has room for them (the dashboard with one property): a line of its
 * description, then where it is, its layout, stay times, where it's listed, its plan and registration, each with an
 * icon. Only what's been entered is shown. Listings are named, not linked: the card around it is itself a link.
 */
export function PropertyDetails({ property: p, feeRateBps }: { property: Property; feeRateBps: number | null }) {
  const facts = propertyFacts(p);
  const listings = [p.airbnbUrl && 'Airbnb', p.vrboUrl && 'Vrbo', p.bookingComUrl && 'Booking.com'].filter(Boolean);
  const registration = [
    p.provincialRegistrationNumber && `BC ${p.provincialRegistrationNumber}`,
    p.businessLicenceNumber && `Licence ${p.businessLicenceNumber}`,
  ].filter(Boolean);
  const rows: { icon: LucideIcon; label: string; value: ReactNode }[] = [
    {
      icon: MapPin,
      label: 'Address',
      value: (
        <>
          {[p.addressLine1, p.addressLine2].filter(Boolean).join(', ')}
          <span className="block text-muted">
            {p.city}, {p.province} {p.postalCode}
          </span>
        </>
      ),
    },
    ...(facts.length > 0 ? [{ icon: BedDouble, label: 'Layout', value: facts.join(' · ') }] : []),
    {
      icon: Clock,
      label: 'Stay times',
      value: `Check-in ${formatTime(p.checkInTime)} · Check-out ${formatTime(p.checkOutTime)}`,
    },
    { icon: Globe, label: 'Listed on', value: listings.length > 0 ? listings.join(' · ') : 'No listings added' },
    {
      icon: Percent,
      label: 'Management plan',
      value:
        feeRateBps === null
          ? 'No plan in force'
          : feeRateBps === 0
            ? 'Owner-managed (0%)'
            : `${formatBps(feeRateBps)} of gross`,
    },
    ...(registration.length > 0 ? [{ icon: FileBadge, label: 'Registration', value: registration.join(' · ') }] : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      {p.description && <p className="line-clamp-2 text-sm text-pretty text-muted">{p.description}</p>}
      <dl className="grid gap-x-6 gap-y-3.5 @[56rem]/card:grid-cols-2">
        {rows.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex min-w-0 items-start gap-3">
            <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-ground text-muted">
              <Icon className="size-4" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="text-sm font-medium text-pretty text-ink">{value}</dd>
            </div>
          </div>
        ))}
      </dl>
    </div>
  );
}
