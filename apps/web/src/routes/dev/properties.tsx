import { createFileRoute, notFound } from '@tanstack/react-router';
import type { Property } from '@truhost/shared';
import { MyPropertyCard, MyPropertyCardSkeleton } from '../../components/properties/my-property-card';
import { PageHeader } from '../../components/ui/page-header';
import { myProperties } from '../../lib/my-properties';

/** Dev only: the owner/cleaner "My properties" cards with sample data and drawn stand-in photos. */
export const Route = createFileRoute('/dev/properties')({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound();
  },
  component: PropertiesPreview,
});

/** A simple drawn "photo": sky, hills and a cabin, in the given colours. */
const scene = (sky: string, hill: string, house: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky}"/><stop offset="1" stop-color="#f6efe4"/></linearGradient></defs><rect width="640" height="400" fill="url(#s)"/><path d="M0 260 Q160 170 320 240 T640 210 V400 H0Z" fill="${hill}" opacity=".75"/><path d="M0 300 Q200 240 400 300 T640 290 V400 H0Z" fill="${hill}"/><rect x="250" y="230" width="140" height="90" fill="${house}"/><path d="M235 235 L320 170 L405 235Z" fill="#3a2a22"/><rect x="300" y="270" width="36" height="50" fill="#f3d9a4"/></svg>`,
  )}`;

const photo = (url: string) => ({ id: 'x', url, thumbUrl: url, expiresAt: '2099-01-01T00:00:00.000Z' });
const base = {
  description: null,
  airbnbUrl: null,
  vrboUrl: null,
  bookingComUrl: null,
  addressLine2: null,
  province: 'BC',
  country: 'CA',
  timeZone: 'America/Vancouver',
  provincialRegistrationNumber: null,
  businessLicenceNumber: null,
  archivedAt: null,
} as const;
const PROPERTIES: Property[] = [
  {
    ...base,
    id: 'a',
    name: 'Cedar Suite',
    addressLine1: '1 Yew St',
    city: 'Chilliwack',
    postalCode: 'V2P 1A1',
    bedrooms: 2,
    bathrooms: 1,
    halfBathrooms: 1,
    maxGuests: 4,
    checkInTime: '16:00',
    checkOutTime: '11:00',
    coverPhoto: photo(scene('#9ec5e8', '#6f9a6a', '#d8b48a')),
  },
  {
    ...base,
    id: 'b',
    name: 'Harbour View Loft',
    addressLine1: '1200 Beach Ave',
    city: 'Vancouver',
    postalCode: 'V6E 1V3',
    bedrooms: 1,
    bathrooms: 1,
    halfBathrooms: 0,
    maxGuests: 3,
    checkInTime: '15:00',
    checkOutTime: '10:30',
    coverPhoto: photo(scene('#f2b8a0', '#5d7f99', '#e9e2d0')),
  },
  {
    ...base,
    id: 'c',
    name: 'Alpine Cabin',
    addressLine1: '45 Alpine Way',
    city: 'Whistler',
    postalCode: 'V8E 0A1',
    bedrooms: 3,
    bathrooms: 2,
    halfBathrooms: 0,
    maxGuests: 6,
    checkInTime: '16:00',
    checkOutTime: '11:00',
    coverPhoto: null,
  },
  {
    ...base,
    id: 'd',
    name: 'Lakeside Studio',
    addressLine1: '9 Shore Rd',
    city: 'Harrison Hot Springs',
    postalCode: 'V0M 1K0',
    bedrooms: 0,
    bathrooms: 1,
    halfBathrooms: 0,
    maxGuests: 2,
    checkInTime: '16:00',
    checkOutTime: '11:00',
    coverPhoto: photo(scene('#c7d9ef', '#4f8a8b', '#c9a27e')),
  },
];

const ME = {
  memberships: [
    { id: 'm1', role: 'OWNER' as const, property: { id: 'a', name: 'Cedar Suite' } },
    { id: 'm2', role: 'OWNER' as const, property: { id: 'b', name: 'Harbour View Loft' } },
    { id: 'm3', role: 'OWNER' as const, property: { id: 'c', name: 'Alpine Cabin' } },
    { id: 'm4', role: 'CLEANER' as const, property: { id: 'd', name: 'Lakeside Studio' } },
  ],
};

const GRID = 'grid grid-cols-[repeat(auto-fill,minmax(min(100%,19rem),1fr))] gap-5';

function PropertiesPreview() {
  const { owned, cleaned } = myProperties(ME, PROPERTIES);
  return (
    <div className="@container/content min-h-dvh bg-ground px-4 py-8 @2xl/content:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <div>
          <PageHeader title="My properties" description="You own 3 properties and clean 1 property." />
          <div className="flex flex-col gap-10">
            {[
              ['Properties you own', owned],
              ['Properties you clean', cleaned],
            ].map(([title, items]) => (
              <section key={title as string} aria-label={title as string} className="flex flex-col gap-4">
                <h2 className="text-sm font-semibold tracking-[0.08em] text-muted uppercase">{title as string}</h2>
                <ul className={GRID}>
                  {(items as typeof owned).map((item) => (
                    <li key={item.property.id}>
                      <MyPropertyCard item={item} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
        <section aria-label="Loading">
          <h2 className="mb-4 text-sm font-semibold text-muted">While loading</h2>
          <div className={GRID}>
            {[0, 1, 2].map((i) => (
              <MyPropertyCardSkeleton key={i} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
