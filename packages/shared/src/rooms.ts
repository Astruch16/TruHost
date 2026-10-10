import type { RoomType } from './enums.js';

/** What each room type is called, in the order types are offered. */
export const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  BEDROOM: 'Bedroom',
  BATHROOM: 'Bathroom',
  HALF_BATH: 'Half bath',
  KITCHEN: 'Kitchen',
  LIVING: 'Living room',
  DINING: 'Dining room',
  LAUNDRY: 'Laundry',
  ENTRY: 'Entry',
  OFFICE: 'Office',
  PATIO_DECK: 'Patio/Deck',
  HOT_TUB: 'Hot tub',
  GARAGE: 'Garage',
  OTHER: 'Other',
};

/** A label must be given for this type (an "Other" room needs a name). */
export const roomTypeNeedsLabel = (type: RoomType) => type === 'OTHER';

/** Trims and collapses inner spaces; empty becomes null ("no label"). */
export function normalizeRoomLabel(label: string | null | undefined): string | null {
  const cleaned = (label ?? '').replace(/\s+/g, ' ').trim();
  return cleaned === '' ? null : cleaned;
}

/**
 * The names rooms are shown by, from their type, label and walkthrough order:
 * - a label: "Bedroom · Primary";
 * - the only room of its type: "Kitchen";
 * - several of a type: unlabelled ones are numbered by their place among that type, in walkthrough order
 *   ("Bedroom · Primary", "Bedroom 2", "Bedroom 3").
 *
 * `rooms` are a property's active rooms in walkthrough order. Display only: the API uses this to answer with names
 * and to refuse two rooms with the same name; it never identifies a room (ids do).
 */
export function roomDisplayNames<T extends { id: string; type: RoomType; label: string | null }>(
  rooms: readonly T[],
): Map<string, string> {
  const ofType = new Map<RoomType, number>();
  for (const r of rooms) ofType.set(r.type, (ofType.get(r.type) ?? 0) + 1);
  const seen = new Map<RoomType, number>();
  const names = new Map<string, string>();
  for (const r of rooms) {
    const nth = (seen.get(r.type) ?? 0) + 1;
    seen.set(r.type, nth);
    const type = ROOM_TYPE_LABELS[r.type];
    const label = normalizeRoomLabel(r.label);
    names.set(r.id, label ? `${type} · ${label}` : ofType.get(r.type)! > 1 ? `${type} ${nth}` : type);
  }
  return names;
}

/** The first display name shared by two rooms (compared without case), or null if all are distinct. */
export function duplicateRoomName(names: Iterable<string>): string | null {
  const seen = new Set<string>();
  for (const name of names) {
    const key = name.toLocaleLowerCase('en-CA');
    if (seen.has(key)) return name;
    seen.add(key);
  }
  return null;
}
