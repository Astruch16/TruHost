import type { Me, Property } from '@truhost/shared';

/** "16:00" → "4 PM", "10:30" → "10:30 AM" (property-local times, shown as written). */
export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`;
}

/** Short facts for a property card, from what's been entered: "3 bedrooms", "2.5 baths", "Sleeps 6". */
export function propertyFacts(p: Pick<Property, 'bedrooms' | 'bathrooms' | 'halfBathrooms' | 'maxGuests'>): string[] {
  const facts: string[] = [];
  if (p.bedrooms !== null)
    facts.push(p.bedrooms === 0 ? 'Studio' : `${p.bedrooms} bedroom${p.bedrooms === 1 ? '' : 's'}`);
  if (p.bathrooms !== null || p.halfBathrooms) {
    const baths = (p.bathrooms ?? 0) + (p.halfBathrooms ?? 0) / 2;
    facts.push(`${baths} bath${baths === 1 ? '' : 's'}`);
  }
  if (p.maxGuests !== null) facts.push(`Sleeps ${p.maxGuests}`);
  return facts;
}

export interface MyProperty {
  property: Property;
  role: 'OWNER' | 'CLEANER';
  /** For the card's tint when there's no photo, stable across visits. */
  index: number;
}

/**
 * The properties this person holds a membership on, split by role, in the order of the property list. Properties
 * the API didn't return (archived ones) are left out.
 */
export function myProperties(
  me: Pick<Me, 'memberships'>,
  properties: Property[],
): { owned: MyProperty[]; cleaned: MyProperty[] } {
  const roles = new Map(me.memberships.map((m) => [m.property.id, m.role]));
  const mine = properties
    .map((property, index) => ({ property, index, role: roles.get(property.id) }))
    .filter((p): p is MyProperty => p.role !== undefined);
  return { owned: mine.filter((p) => p.role === 'OWNER'), cleaned: mine.filter((p) => p.role === 'CLEANER') };
}
