import type { Property } from '@truhost/shared';

/** What the property form edits (create and update). Optional details are null when left empty. */
export interface PropertyFormValues {
  name: string;
  description: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  postalCode: string;
  bedrooms: number | null;
  bathrooms: number | null;
  halfBathrooms: number | null;
  maxGuests: number | null;
  checkInTime: string;
  checkOutTime: string;
  airbnbUrl: string | null;
  vrboUrl: string | null;
  bookingComUrl: string | null;
  provincialRegistrationNumber: string | null;
  businessLicenceNumber: string | null;
  defaultCleanerPayCents: number;
  standardCleaningFeeCents: number;
}

export const emptyProperty: PropertyFormValues = {
  name: '',
  description: null,
  addressLine1: '',
  addressLine2: null,
  city: 'Vancouver',
  postalCode: '',
  bedrooms: null,
  bathrooms: null,
  halfBathrooms: null,
  maxGuests: null,
  checkInTime: '16:00',
  checkOutTime: '11:00',
  airbnbUrl: null,
  vrboUrl: null,
  bookingComUrl: null,
  provincialRegistrationNumber: null,
  businessLicenceNumber: null,
  defaultCleanerPayCents: 0,
  standardCleaningFeeCents: 0,
};

/** A property as the form's starting values (admins see the money fields; they default to 0 otherwise). */
export function propertyToFormValues(p: Property): PropertyFormValues {
  return {
    name: p.name,
    description: p.description,
    addressLine1: p.addressLine1,
    addressLine2: p.addressLine2,
    city: p.city,
    postalCode: p.postalCode,
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
    halfBathrooms: p.halfBathrooms,
    maxGuests: p.maxGuests,
    checkInTime: p.checkInTime,
    checkOutTime: p.checkOutTime,
    airbnbUrl: p.airbnbUrl,
    vrboUrl: p.vrboUrl,
    bookingComUrl: p.bookingComUrl,
    provincialRegistrationNumber: p.provincialRegistrationNumber,
    businessLicenceNumber: p.businessLicenceNumber,
    defaultCleanerPayCents: p.defaultCleanerPayCents ?? 0,
    standardCleaningFeeCents: p.standardCleaningFeeCents ?? 0,
  };
}

/** "3 bedrooms · 2.5 baths · sleeps 6", from whatever is filled in; null when nothing is. */
export function layoutSummary(
  p: Pick<Property, 'bedrooms' | 'bathrooms' | 'halfBathrooms' | 'maxGuests'>,
): string | null {
  const parts: string[] = [];
  if (p.bedrooms !== null)
    parts.push(p.bedrooms === 0 ? 'Studio' : `${p.bedrooms} bedroom${p.bedrooms === 1 ? '' : 's'}`);
  if (p.bathrooms !== null || p.halfBathrooms !== null) {
    const full = p.bathrooms ?? 0;
    const half = p.halfBathrooms ?? 0;
    const label = half === 0 ? `${full}` : half === 1 ? `${full}.5` : `${full} + ${half} half`;
    parts.push(`${label} bath${full === 1 && half === 0 ? '' : 's'}`);
  }
  if (p.maxGuests !== null) parts.push(`sleeps ${p.maxGuests}`);
  return parts.length ? parts.join(' · ') : null;
}
