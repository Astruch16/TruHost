import type { ReactNode } from 'react';
import { ExternalLink, Pencil } from 'lucide-react';
import type { Property } from '@truhost/shared';
import { formatCents } from '../lib/money';
import { layoutSummary } from '../lib/property-values';
import { Button } from './ui/button';
import { Card } from './ui/card';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="min-w-0 text-sm text-ink">{children}</dd>
    </div>
  );
}

const notSet = <span className="text-muted">Not set</span>;

/** A property's details at a glance, with Edit opening the full form. */
export function PropertyDetailsCard({ property: p, onEdit }: { property: Property; onEdit: () => void }) {
  const listings = [
    { name: 'Airbnb', url: p.airbnbUrl },
    { name: 'VRBO', url: p.vrboUrl },
    { name: 'Booking.com', url: p.bookingComUrl },
  ].flatMap((l) => (l.url ? [{ name: l.name, url: l.url }] : []));

  return (
    <Card
      title="Details"
      actions={
        <Button variant="secondary" size="sm" onClick={onEdit}>
          <Pencil aria-hidden className="size-4" /> Edit details
        </Button>
      }
    >
      <dl className="divide-y divide-line-soft">
        {p.description && <Row label="Description">{p.description}</Row>}
        <Row label="Address">
          {p.addressLine1}
          {p.addressLine2 && `, ${p.addressLine2}`}
          <br />
          {p.city}, {p.province} {p.postalCode}
        </Row>
        <Row label="Layout">{layoutSummary(p) ?? notSet}</Row>
        <Row label="Check-in / out">
          <span className="figure">
            {p.checkInTime} / {p.checkOutTime}
          </span>
        </Row>
        <Row label="Listings">
          {listings.length === 0 ? (
            notSet
          ) : (
            <span className="flex flex-wrap gap-x-4 gap-y-1">
              {listings.map(({ name, url }) => (
                <a
                  key={name}
                  href={url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 font-semibold text-sage-deep hover:underline"
                >
                  {name}
                  <ExternalLink aria-hidden className="size-3.5" />
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              ))}
            </span>
          )}
        </Row>
        <Row label="BC STR registration">{p.provincialRegistrationNumber ?? notSet}</Row>
        <Row label="Business licence">{p.businessLicenceNumber ?? notSet}</Row>
        {p.standardCleaningFeeCents !== undefined && (
          <Row label="Cleaning fee">
            <span className="figure">{formatCents(p.standardCleaningFeeCents)}</span>
            <span className="text-muted"> charged to guests</span>
          </Row>
        )}
        {p.defaultCleanerPayCents !== undefined && (
          <Row label="Cleaner pay">
            <span className="figure">{formatCents(p.defaultCleanerPayCents)}</span>
            <span className="text-muted"> per clean</span>
          </Row>
        )}
      </dl>
    </Card>
  );
}
