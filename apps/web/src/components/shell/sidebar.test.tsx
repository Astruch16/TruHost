import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import { navItems } from '../../lib/nav';
import { Sidebar } from './sidebar';

async function renderSidebar() {
  const onSignOut = vi.fn();
  const router = createRouter({
    routeTree: createRootRoute({
      component: () => <Sidebar items={navItems({ staffRole: 'ADMIN', memberships: [] })} onSignOut={onSignOut} />,
    }),
    history: createMemoryHistory({ initialEntries: ['/admin'] }),
  });
  render(<RouterProvider router={router} />);
  await screen.findByRole('navigation', { name: 'Main' });
  return onSignOut;
}

describe('sidebar', () => {
  it('keeps Log out at the foot, out of the main nav, with the app’s version and build', async () => {
    const onSignOut = await renderSidebar();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(onSignOut).toHaveBeenCalled();
    expect(screen.getByText(new RegExp(`TruHost v${__APP_VERSION__}`))).toHaveTextContent(__APP_COMMIT__);
  });
});
