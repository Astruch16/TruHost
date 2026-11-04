import type { Property } from '@truhost/shared';
import { useQuery } from '@tanstack/react-query';
import { Clock, MapPin, Pencil } from 'lucide-react';
import { useApi } from '../lib/api-context';
import { RoomIcon } from './illustrations/room-icons';
import { queries } from '../lib/queries';
import { ErrorAlert } from './ui/alert';
import { Button } from './ui/button';
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

/**
 * The property's rooms, each with its type's icon, in the order a cleaner walks through them: a numbered step down the
 * left, joined by a line like the checklist's timeline, so the number reads as the order, not how many. Compact: it sits
 * in a side column. `onEdit` adds an Edit button (admins).
 */
export function PropertyRoomsCard({
  propertyId,
  className,
  onEdit,
}: {
  propertyId: string;
  className?: string;
  onEdit?: () => void;
}) {
  const rooms = useQuery(queries.rooms(useApi(), propertyId));
  return (
    <Card
      title="Rooms"
      description="The order the cleaning checklist goes through them, first to last."
      className={className}
      actions={
        onEdit ? (
          <Button variant="secondary" size="sm" onClick={onEdit}>
            <Pencil aria-hidden className="size-4" /> Edit rooms
          </Button>
        ) : undefined
      }
    >
      {rooms.error ? (
        <ErrorAlert error={rooms.error} />
      ) : !rooms.data ? (
        <Skeleton className="h-16" />
      ) : rooms.data.items.length === 0 ? (
        <p className="text-sm text-muted">
          No rooms added yet.{onEdit && ' Use Edit rooms to set up the walkthrough.'}
        </p>
      ) : (
        <ol className="flex flex-col text-sm">
          {rooms.data.items.map((r, i, all) => (
            <li key={r.id} className="relative flex items-center gap-3 py-1.5">
              {/* The line down to the next step. */}
              {i < all.length - 1 && (
                <span
                  aria-hidden
                  className="absolute top-[calc(50%+11px)] left-[10.5px] h-[calc(100%-22px)] w-px bg-line"
                />
              )}
              <span
                aria-hidden
                className="figure grid size-[22px] shrink-0 place-items-center rounded-full border border-line bg-surface text-[11px] font-semibold text-muted"
              >
                {i + 1}
              </span>
              <RoomIcon type={r.type} size={36} className="shrink-0" />
              <span className="min-w-0 flex-1 truncate font-medium text-ink">
                <span className="sr-only">Step {i + 1}: </span>
                {r.displayName}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
