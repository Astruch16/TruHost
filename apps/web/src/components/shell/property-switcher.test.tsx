import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PropertySwitcher, type SwitcherProperty } from './property-switcher';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    children,
    onClick,
    className,
  }: {
    to: string;
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
  }) => (
    <a href={to} onClick={onClick} className={className}>
      {children}
    </a>
  ),
}));

const properties: SwitcherProperty[] = [
  { id: 'a', name: 'Cedar Suite', city: 'Chilliwack', province: 'BC', photoUrl: 'https://r2.test/a-card.jpg' },
  { id: 'b', name: 'Lakeview Cabin', city: 'Cultus Lake', province: 'BC', photoUrl: null },
  { id: 'c', name: 'Garden Loft', city: 'Chilliwack', province: 'BC', photoUrl: 'https://r2.test/c-card.jpg' },
];

const setup = (props: Partial<Parameters<typeof PropertySwitcher>[0]> = {}) => {
  const onSelect = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <PropertySwitcher properties={properties} selectedId="a" onSelect={onSelect} allowAll {...props} />
    </QueryClientProvider>,
  );
  return { onSelect, user: userEvent.setup() };
};
const panelList = () => screen.getByRole('list', { name: 'Properties' });

describe('PropertySwitcher', () => {
  it('shows the selected property with its photo', () => {
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <PropertySwitcher properties={properties} selectedId="a" onSelect={vi.fn()} />
      </QueryClientProvider>,
    );
    const trigger = screen.getByRole('button', { name: 'Property: Cedar Suite. Switch property' });
    expect(trigger).toHaveTextContent('Chilliwack, BC');
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://r2.test/a-card.jpg');
  });

  it('lists every property with its photo (or initials), marks the current one, and switches', async () => {
    const { onSelect, user } = setup();
    await user.click(screen.getByRole('button', { name: /Switch property/ }));
    expect(screen.getByText('Switch property')).toBeInTheDocument();
    expect(screen.getAllByText('3 properties').length).toBeGreaterThan(0);

    const rows = within(panelList()).getAllByRole('button');
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining('All propertiesThe whole portfolio · 3 properties'),
      expect.stringContaining('Cedar SuiteChilliwack, BC'),
      expect.stringContaining('Lakeview CabinCultus Lake, BC'),
      expect.stringContaining('Garden LoftChilliwack, BC'),
    ]);
    expect(rows[1]).toHaveAttribute('aria-current', 'true');
    expect(within(rows[1]!).getByLabelText('Selected')).toBeInTheDocument();
    expect(within(rows[3]!).getByRole('presentation', { hidden: true })).toHaveAttribute(
      'src',
      'https://r2.test/c-card.jpg',
    );
    expect(within(rows[2]!).getByText('LC')).toBeInTheDocument(); // no photo: initials

    await user.click(rows[3]!);
    expect(onSelect).toHaveBeenCalledWith('c');
  });

  it('searches by name or town, clears, and says when nothing matches', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /Switch property/ }));
    await user.type(screen.getByRole('textbox', { name: 'Search properties' }), 'chill');
    expect(
      within(panelList())
        .getAllByRole('button')
        .map((r) => r.textContent),
    ).toEqual([expect.stringContaining('Cedar Suite'), expect.stringContaining('Garden Loft')]);
    await user.type(screen.getByRole('textbox', { name: 'Search properties' }), 'zzz');
    expect(screen.getByText('No properties match “chillzzz”')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(within(panelList()).getAllByRole('button')).toHaveLength(4);
    expect(screen.getByRole('textbox', { name: 'Search properties' })).toHaveFocus();
  });

  it('moves through the list with the arrow keys and picks with Enter', async () => {
    const { onSelect, user } = setup();
    await user.click(screen.getByRole('button', { name: /Switch property/ }));
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
    expect(document.activeElement).toHaveTextContent('Lakeview Cabin');
    await user.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}');
    expect(screen.getByRole('textbox', { name: 'Search properties' })).toHaveFocus();
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onSelect).toHaveBeenCalledWith(null); // All properties
  });

  it('offers All properties and Manage properties to admins only', async () => {
    const { user } = setup({ allowAll: false });
    await user.click(screen.getByRole('button', { name: /Switch property/ }));
    expect(within(panelList()).queryByText('All properties')).toBeNull();
    expect(screen.queryByRole('link', { name: /Manage properties/ })).toBeNull();
  });

  it('links admins to the properties page', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /Switch property/ }));
    expect(screen.getByRole('link', { name: /Manage properties/ })).toHaveAttribute('href', '/admin/properties');
  });
});
