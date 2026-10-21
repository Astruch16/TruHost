import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClearCacheOnUserChange } from './clear-cache-on-user-change';

const auth = vi.hoisted(() => ({ isLoaded: true, userId: 'admin' as string | null }));
vi.mock('@clerk/react', () => ({ useAuth: () => auth }));

describe('ClearCacheOnUserChange', () => {
  afterEach(() => {
    auth.isLoaded = true;
    auth.userId = 'admin';
  });

  const setup = () => {
    const client = new QueryClient();
    client.setQueryData(['me'], { staffRole: 'ADMIN' });
    client.setQueryData(['me', 'onboarding'], { tours: [] });
    const view = render(
      <QueryClientProvider client={client}>
        <ClearCacheOnUserChange />
      </QueryClientProvider>,
    );
    const rerender = () =>
      view.rerender(
        <QueryClientProvider client={client}>
          <ClearCacheOnUserChange />
        </QueryClientProvider>,
      );
    return { client, rerender };
  };

  it('keeps the cache while the same person stays signed in', () => {
    const { client, rerender } = setup();
    rerender();
    expect(client.getQueryData(['me'])).toEqual({ staffRole: 'ADMIN' });
  });

  it('forgets everything on sign-out, so the next person never sees the last one’s profile or tours', () => {
    const { client, rerender } = setup();
    auth.userId = null;
    rerender();
    expect(client.getQueryData(['me'])).toBeUndefined();
    expect(client.getQueryData(['me', 'onboarding'])).toBeUndefined();
  });

  it('forgets everything when someone else signs in on the same tab', () => {
    const { client, rerender } = setup();
    auth.userId = 'cleaner';
    rerender();
    expect(client.getQueryData(['me'])).toBeUndefined();
  });

  it('does nothing until Clerk knows who is signed in', () => {
    auth.isLoaded = false;
    auth.userId = null;
    const { client, rerender } = setup();
    auth.isLoaded = true;
    auth.userId = 'admin';
    rerender();
    expect(client.getQueryData(['me'])).toEqual({ staffRole: 'ADMIN' });
  });
});
