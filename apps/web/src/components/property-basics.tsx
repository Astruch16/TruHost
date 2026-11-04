import type { Property } from '@truhost/shared';
import { useEffect, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Copy, Navigation, Pencil } from 'lucide-react';
import { useApi } from '../lib/api-context';
import { AddressMap } from './illustrations/address-map';
import { DoorOpenIcon, ReadyByIcon } from './illustrations/list-icons';
import { RoomIcon } from './illustrations/room-icons';
import { cx } from '../lib/cx';
import { buttonStyles } from '../lib/styles';
import { queries } from '../lib/queries';
import { ErrorAlert } from './ui/alert';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Skeleton } from './ui/skeleton';

/**
 * Address and stay times: what everyone with access to a property can see. A drawn map (not a real one) heads it; the
 * address comes with Directions (opens the address in Google Maps) and Copy; then check-out and check-in, the two times a
 * clean fits between. In a row with a taller card, the map grows (up to a point) to fill the height.
 */
export function PropertyAddressCard({ property: p }: { property: Property }) {
  const street = p.addressLine2 ? `${p.addressLine1}, ${p.addressLine2}` : p.addressLine1;
  const locality = `${p.city}, ${p.province} ${p.postalCode}`;
  const full = `${street}, ${locality}`;
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <Card title="Address" className="flex flex-col">
      <div className="flex flex-1 flex-col gap-4 @container/address">
        <div className="relative max-h-52 min-h-24 flex-1 overflow-hidden rounded-inner ring-1 ring-line-soft">
          <AddressMap className="absolute inset-0 size-full" />
        </div>
        <div>
          <p className="text-base font-semibold text-ink">{street}</p>
          <p className="text-sm text-muted">{locality}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(full)}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Directions (opens in a new tab)"
              className={buttonStyles({ variant: 'secondary', size: 'sm' })}
            >
              <Navigation aria-hidden className="size-4" /> Directions
            </a>
            <Button
              variant="secondary"
              size="sm"
              aria-label={copied ? 'Address copied' : 'Copy address'}
              onClick={() => void navigator.clipboard?.writeText(full).then(() => setCopied(true))}
            >
              {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
              {/* Icon only in a narrow card, so the two buttons stay on one line. */}
              <span className="hidden @[17rem]/address:inline">{copied ? 'Copied' : 'Copy'}</span>
            </Button>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-2">
          <StayTime icon={<DoorOpenIcon size={34} />} label="Check-out" time={p.checkOutTime} />
          <StayTime icon={<ReadyByIcon size={34} />} label="Check-in" time={p.checkInTime} />
        </dl>
      </div>
    </Card>
  );
}

function StayTime({ icon, label, time }: { icon: ReactNode; label: string; time: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-inner border border-line-soft bg-ground/60 p-2.5 @[17rem]/address:flex-row @[17rem]/address:items-center @[17rem]/address:gap-2.5">
      <span className="shrink-0">{icon}</span>
      <div className="min-w-0">
        <dt className="truncate text-xs text-muted">{label}</dt>
        <dd className="figure text-base font-semibold text-ink">{time}</dd>
      </div>
    </div>
  );
}

/**
 * The property's rooms as tiles, each with its type's icon, in the order a cleaner walks through them. The step number
 * is a badge on the icon and the description says it's the order, so it doesn't read as how many. Two tiles a row, more
 * where the card is wide; the name sits under the icon, so it fits a narrow column. `onEdit` adds an Edit button
 * (admins).
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
      description={
        rooms.data && rooms.data.items.length > 0
          ? `${rooms.data.items.length} room${rooms.data.items.length === 1 ? '' : 's'}, numbered in the order the cleaning checklist goes through them.`
          : 'Numbered in the order the cleaning checklist goes through them.'
      }
      className={cx('flex flex-col', className)}
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
        // Rows stretch into spare height when the card shares a row with a taller one; otherwise they fit their content.
        <div className="flex flex-1 flex-col @container/rooms">
          <ol className="grid flex-1 grid-cols-2 gap-2 @md/rooms:grid-cols-3 @3xl/rooms:grid-cols-4">
            {rooms.data.items.map((r, i) => (
              <li
                key={r.id}
                className="flex min-w-0 flex-col items-center justify-center gap-2 rounded-inner border border-line-soft bg-ground/60 px-2 py-3 text-center"
              >
                <span className="relative shrink-0">
                  <RoomIcon type={r.type} size={40} />
                  <span
                    aria-hidden
                    className="figure absolute -top-1 -right-1.5 grid size-[18px] place-items-center rounded-full bg-ink text-[10px] font-bold text-white ring-2 ring-surface"
                  >
                    {i + 1}
                  </span>
                </span>
                <span className="line-clamp-2 max-w-full text-sm leading-snug font-medium break-words text-ink">
                  <span className="sr-only">Step {i + 1}: </span>
                  {r.displayName}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </Card>
  );
}
