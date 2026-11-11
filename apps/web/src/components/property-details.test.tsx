import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Property } from '@truhost/shared';
import { PropertyDetails } from './property-details';

const PROPERTY = {
  id: 'p1',
  name: 'Cedar Cabin',
  description: 'A cabin by the lake.',
  bedrooms: 2,
  bathrooms: 1,
  halfBathrooms: 1,
  maxGuests: 5,
  airbnbUrl: 'https://www.airbnb.ca/rooms/1',
  vrboUrl: null,
  bookingComUrl: 'https://www.booking.com/hotel/1',
  addressLine1: '100 Example Road',
  addressLine2: null,
  city: 'Chilliwack',
  province: 'BC',
  postalCode: 'V2P 0A1',
  country: 'CA',
  timeZone: 'America/Vancouver',
  checkInTime: '16:00',
  checkOutTime: '11:00',
  provincialRegistrationNumber: null,
  businessLicenceNumber: null,
  archivedAt: null,
  coverPhoto: null,
} satisfies Property;

const detail = (label: string) => screen.getByText(label, { selector: 'dt' }).nextElementSibling;

describe('property details', () => {
  it('lists where it is, its layout, stay times, listings and plan', () => {
    render(<PropertyDetails property={PROPERTY} feeRateBps={2200} />);
    expect(screen.getByText('A cabin by the lake.')).toBeInTheDocument();
    expect(detail('Address')).toHaveTextContent('100 Example RoadChilliwack, BC V2P 0A1');
    expect(detail('Layout')).toHaveTextContent('2 bedrooms · 1.5 baths · Sleeps 5');
    expect(detail('Stay times')).toHaveTextContent('Check-in 4 PM · Check-out 11 AM');
    // Named, not linked: the card around it is a link.
    expect(detail('Listed on')).toHaveTextContent('Airbnb · Booking.com');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(detail('Management plan')).toHaveTextContent('22% of gross');
  });

  it('leaves out what hasn’t been entered, and reads a 0% plan as owner-managed', () => {
    render(
      <PropertyDetails
        property={{
          ...PROPERTY,
          description: null,
          bedrooms: null,
          bathrooms: null,
          halfBathrooms: null,
          maxGuests: null,
          airbnbUrl: null,
          bookingComUrl: null,
        }}
        feeRateBps={0}
      />,
    );
    expect(screen.queryByText('Layout')).not.toBeInTheDocument();
    expect(screen.queryByText('Registration')).not.toBeInTheDocument();
    expect(detail('Listed on')).toHaveTextContent('No listings added');
    expect(detail('Management plan')).toHaveTextContent('Owner-managed (0%)');
  });
});
