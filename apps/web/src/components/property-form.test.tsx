import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { emptyProperty, layoutSummary } from '../lib/property-values';
import { PropertyForm } from './property-form';

const renderForm = (initial = emptyProperty) => {
  const onSubmit = vi.fn();
  render(
    <PropertyForm initial={initial} submitLabel="Create property" pending={false} error={null} onSubmit={onSubmit} />,
  );
  return { onSubmit, user: userEvent.setup() };
};

describe('PropertyForm', () => {
  it('groups the fields into sections', () => {
    renderForm();
    for (const s of ['Basics', 'Address', 'Layout', 'Stays', 'Listings', 'Registration', 'Money']) {
      expect(screen.getByRole('region', { name: s })).toBeInTheDocument();
    }
  });

  it('sends the new details, with empty ones as null', async () => {
    const { onSubmit, user } = renderForm();
    await user.type(screen.getByLabelText(/^Name/), 'Spare Cabin');
    await user.type(screen.getByLabelText(/^Street address/), '9 Sample Rd');
    await user.clear(screen.getByLabelText(/^City/));
    await user.type(screen.getByLabelText(/^City/), 'Hope');
    await user.type(screen.getByLabelText(/^Postal code/), 'V0X 1L0');
    await user.type(screen.getByLabelText(/^Bedrooms/), '3');
    await user.type(screen.getByLabelText(/^Sleeps/), '6');
    await user.type(screen.getByLabelText(/^Airbnb/), 'https://www.airbnb.ca/rooms/1');
    await user.click(screen.getByRole('button', { name: 'Create property' }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Spare Cabin',
        city: 'Hope',
        bedrooms: 3,
        bathrooms: null,
        halfBathrooms: null,
        maxGuests: 6,
        description: null,
        airbnbUrl: 'https://www.airbnb.ca/rooms/1',
        vrboUrl: null,
        standardCleaningFeeCents: 0,
      }),
    );
  });

  it('asks for whole numbers and amounts before sending', async () => {
    const { onSubmit, user } = renderForm();
    await user.type(screen.getByLabelText(/^Bedrooms/), '2.5');
    await user.clear(screen.getByLabelText(/^Cleaner pay/));
    await user.type(screen.getByLabelText(/^Cleaner pay/), 'ninety');
    await user.click(screen.getByRole('button', { name: 'Create property' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Enter a whole number')).toBeInTheDocument();
    expect(screen.getByText('Enter an amount like 90 or 90.50')).toBeInTheDocument();
    expect(screen.getByText('Some fields need a look. They’re marked above.')).toBeInTheDocument();
  });
});

describe('layoutSummary', () => {
  it.each([
    [{ bedrooms: 3, bathrooms: 2, halfBathrooms: 1, maxGuests: 6 }, '3 bedrooms · 2.5 baths · sleeps 6'],
    [{ bedrooms: 1, bathrooms: 1, halfBathrooms: 0, maxGuests: 2 }, '1 bedroom · 1 bath · sleeps 2'],
    [{ bedrooms: 0, bathrooms: 1, halfBathrooms: null, maxGuests: null }, 'Studio · 1 bath'],
    [{ bedrooms: 4, bathrooms: 3, halfBathrooms: 2, maxGuests: 10 }, '4 bedrooms · 3 + 2 half baths · sleeps 10'],
    [{ bedrooms: null, bathrooms: null, halfBathrooms: null, maxGuests: null }, null],
  ])('%o → %s', (layout, expected) => {
    expect(layoutSummary(layout)).toBe(expected);
  });
});
