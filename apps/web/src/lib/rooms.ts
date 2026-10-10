import {
  duplicateRoomName,
  nextRoomNumber,
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

type Numbered = Pick<Room, 'id' | 'type' | 'label' | 'number' | 'archivedAt'>;

/**
 * What a change would be called before it's saved: a new room (no `id`), or an existing room with a new type or
 * label. `rooms` are all the property's rooms, deleted ones included (they hold their numbers), so a new room's
 * number is the one the API will give. `clash` is the name it would share with another room (the API refuses that
 * too), or null.
 */
export function previewRoomName(
  rooms: readonly Numbered[],
  change: { id?: string; type: RoomType; label: string },
): { name: string; clash: string | null; needsLabel: boolean } {
  const current = change.id ? rooms.find((r) => r.id === change.id) : undefined;
  const others = rooms.filter((r) => r.id !== change.id);
  const number = current && current.type === change.type ? current.number : nextRoomNumber(others, change.type);
  const draft = { id: change.id ?? '__new__', type: change.type, label: normalizeRoomLabel(change.label), number };
  const active = rooms.filter((r) => !r.archivedAt);
  const next = change.id ? active.map((r) => (r.id === change.id ? draft : r)) : [...active, draft];
  const names = roomDisplayNames(next);
  return {
    name: names.get(draft.id)!,
    clash: duplicateRoomName(names.values()),
    needsLabel: roomTypeNeedsLabel(change.type) && draft.label === null,
  };
}

/** The list after moving one room. Only the order changes: names come from each room's own number. */
export function reorderedRooms<T extends { position: number }>(rooms: readonly T[], from: number, to: number): T[] {
  const next = [...rooms];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next.map((r, i) => ({ ...r, position: i }));
}
