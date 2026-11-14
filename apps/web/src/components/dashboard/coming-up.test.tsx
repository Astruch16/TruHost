import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import { ComingUp, type UpcomingItem } from './coming-up';

const event = (
  bookingId: string,
  propertyName: string,
  type: UpcomingItem['type'],
  date: string,
  nights = 3,
): UpcomingItem => ({ type, date, bookingId, propertyName, kind: 'GUEST', nights, guestName: null });

const ITEMS = [
  event('b1', 'Seaside Loft', 'CHECK_IN', '2026-11-13'),
  event('b2', 'Cedar Cabin', 'CHECK_IN', '2026-11-15', 6),
  event('b1', 'Seaside Loft', 'CHECK_OUT', '2026-11-16'),
  event('b2', 'Cedar Cabin', 'CHECK_OUT', '2026-11-21', 6),
];

async function renderCard(showProperty = true) {
  const router = createRouter({
    routeTree: createRootRoute({
      component: () => <ComingUp items={ITEMS} total={ITEMS.length} showProperty={showProperty} />,
    }),
    history: createMemoryHistory({ initialEntries: ['/admin'] }),
  });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { name: 'Coming up' });
}

const titles = (list: HTMLElement) =>
  within(list)
    .getAllByRole('listitem')
    .map((li) => li.querySelector('p')?.textContent);

afterEach(() => localStorage.clear());

describe('coming up', () => {
  it('heads each row with its property, by date', async () => {
    await renderCard();
    const list = screen.getByRole('list', { name: 'By date' });
    expect(titles(list)).toEqual(['Seaside Loft', 'Cedar Cabin', 'Seaside Loft', 'Cedar Cabin']);
    expect(within(list).getAllByRole('listitem')[0]).toHaveTextContent('Check-in · 3 nights');
    expect(screen.getByRole('button', { name: 'Date' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('groups by property under its name, and remembers the choice', async () => {
    await renderCard();
    await userEvent.click(screen.getByRole('button', { name: 'Property' }));
    const groups = screen.getAllByRole('region');
    expect(groups.map((g) => g.getAttribute('aria-labelledby') && within(g).getByRole('heading').textContent)).toEqual([
      'Cedar Cabin',
      'Seaside Loft',
    ]);
    expect(titles(within(groups[0]!).getByRole('list'))).toEqual(['Check-in', 'Check-out and clean']);
    expect(localStorage.getItem('truhost:comingUpSort')).toBe('property');
  });

  it('for one property, heads each row with what happens and has no sort', async () => {
    await renderCard(false);
    expect(screen.queryByRole('group', { name: 'Sort' })).not.toBeInTheDocument();
    expect(screen.getAllByText('Check-out and clean', { selector: 'p' })).toHaveLength(2);
    expect(screen.queryByText('Seaside Loft')).not.toBeInTheDocument();
  });
});
