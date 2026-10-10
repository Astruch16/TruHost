import {
  duplicateRoomName,
  normalizeRoomLabel,
  RoomType,
  roomDisplayNames,
  roomTypeNeedsLabel,
  type Room,
} from '@truhost/shared';
import type { LucideIcon } from 'lucide-react';
import {
  Bath,
  BedDouble,
  Briefcase,
  CookingPot,
  DoorOpen,
  Fence,
  Shapes,
  Sofa,
  Toilet,
  UtensilsCrossed,
  Warehouse,
  WashingMachine,
  Waves,
} from 'lucide-react';

/** Room types in the order they're offered. */
export const ROOM_TYPES = RoomType.options;
export type { RoomType };

export const ROOM_ICONS: Record<RoomType, LucideIcon> = {
  BEDROOM: BedDouble,
  BATHROOM: Bath,
  HALF_BATH: Toilet,
  KITCHEN: CookingPot,
  LIVING: Sofa,
  DINING: UtensilsCrossed,
  LAUNDRY: WashingMachine,
  ENTRY: DoorOpen,
  OFFICE: Briefcase,
  PATIO_DECK: Fence,
  HOT_TUB: Waves,
  GARAGE: Warehouse,
  OTHER: Shapes,
};

export const LABEL_PLACEHOLDER = 'Optional, e.g. Primary, Ensuite, Loft';
export const MAX_PER_TYPE = 20;

export type RoomCounts = Record<RoomType, number>;

/**
 * Starting counts for quick setup: bedrooms and bathrooms from the property's layout (if entered), one kitchen and
 * one living room, nothing else. Other isn't counted: an Other room needs a name, so it's added on its own.
 */
export function quickSetupCounts(p: {
  bedrooms: number | null;
  bathrooms: number | null;
  halfBathrooms: number | null;
}): RoomCounts {
  const cap = (n: number) => Math.min(MAX_PER_TYPE, Math.max(0, n));
  const counts = Object.fromEntries(ROOM_TYPES.map((t) => [t, 0])) as RoomCounts;
  counts.BEDROOM = cap(p.bedrooms ?? 1);
  counts.BATHROOM = cap(p.bathrooms ?? 1);
  counts.HALF_BATH = cap(p.halfBathrooms ?? 0);
  counts.KITCHEN = 1;
  counts.LIVING = 1;
  return counts;
}

/** The rooms quick setup creates: each type's count, in the order types are offered. */
export function roomsFromCounts(counts: RoomCounts): { type: RoomType }[] {
  return ROOM_TYPES.filter((t) => !roomTypeNeedsLabel(t)).flatMap((type) =>
    Array.from({ length: counts[type] }, () => ({ type })),
  );
}

type Named = Pick<Room, 'id' | 'type' | 'label'>;

/**
 * What a change would be called before it's saved: a new room (no `id`) at the end, or an existing room with a new
 * type or label. `clash` is the name it would share with another room (the API refuses that too), or null.
 */
export function previewRoomName(
  rooms: readonly Named[],
  change: { id?: string; type: RoomType; label: string },
): { name: string; clash: string | null; needsLabel: boolean } {
  const draft = { id: change.id ?? '__new__', type: change.type, label: normalizeRoomLabel(change.label) };
  const next = change.id ? rooms.map((r) => (r.id === change.id ? draft : r)) : [...rooms, draft];
  const names = roomDisplayNames(next);
  return {
    name: names.get(draft.id)!,
    clash: duplicateRoomName(names.values()),
    needsLabel: roomTypeNeedsLabel(change.type) && draft.label === null,
  };
}

/** The list after moving one room, renumbered as the API will (for showing the new order straight away). */
export function reorderedRooms<T extends Named & { position: number; displayName: string }>(
  rooms: readonly T[],
  from: number,
  to: number,
): T[] {
  const next = [...rooms];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  const names = roomDisplayNames(next);
  return next.map((r, i) => ({ ...r, position: i, displayName: names.get(r.id)! }));
}
