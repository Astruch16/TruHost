import type { Property } from '@truhost/shared';
import { useQuery } from '@tanstack/react-query';
import { Clock, MapPin } from 'lucide-react';
import { useApi } from '../lib/api-context';
import { queries } from '../lib/queries';
import { ErrorAlert } from './ui/alert';
import { Card } from './ui/card';
import { Skeleton } from './ui/skeleton';

/** Address and stay times: what everyone with access to a property can see. */
export function PropertyAddressCard({ property: p }: { property: Property }) {
  return (
    <Card title="Address">
      <div className="flex flex-col gap-3 text-sm">
        <p className="flex gap-2.5">
          <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
          <span>
            {p.addressLine1}
            {p.addressLine2 && <>, {p.addressLine2}</>}
            <br />
            {p.city}, {p.province} {p.postalCode}
          </span>
        </p>
        <p className="flex gap-2.5">
          <Clock aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
          <span className="figure">
            Check-in {p.checkInTime} · Check-out {p.checkOutTime}
          </span>
        </p>
      </div>
    </Card>
  );
}

/** The property's rooms, in the order a cleaner walks through them. */
export function PropertyRoomsCard({ propertyId, className }: { propertyId: string; className?: string }) {
  const rooms = useQuery(queries.rooms(useApi(), propertyId));
  return (
    <Card title="Rooms" description="In cleaning-checklist order." className={className}>
      {rooms.error ? (
        <ErrorAlert error={rooms.error} />
      ) : !rooms.data ? (
        <Skeleton className="h-16" />
      ) : rooms.data.items.length === 0 ? (
        <p className="text-sm text-muted">No rooms added yet.</p>
      ) : (
        <ol className="flex flex-col divide-y divide-line-soft text-sm">
          {rooms.data.items.map((r, i) => (
            <li key={r.id} className="flex items-center gap-3 py-2.5">
              <span className="figure grid size-6 place-items-center rounded-full bg-ground text-xs font-semibold text-muted">
                {i + 1}
              </span>
              {r.name}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
