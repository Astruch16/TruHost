import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import type { ApiClient } from '@truhost/api-client';
import { landingPath, warmPortal } from './portal-entry';

const ok = (data: unknown) => Promise.resolve({ data, response: new Response(null, { status: 200 }) });
const membership = (role: 'OWNER' | 'CLEANER', id = 'p1') => ({ id: `m-${id}`, role, property: { id, name: id } });
const me = (staffRole: 'ADMIN' | null, memberships: ReturnType<typeof membership>[]) => ({
  id: 'u1',
  firstName: 'Sam',
  lastName: 'Lee',
  email: 'sam@example.test',
  staffRole,
  memberships,
});

/** A fake API answering by path, recording what was asked for. */
function fakeApi(routes: Record<string, unknown>) {
  const asked: string[] = [];
  const GET = vi.fn((path: string) => {
    asked.push(path);
    if (!(path in routes))
      return Promise.resolve({ error: { message: 'nope' }, response: new Response(null, { status: 500 }) });
    return ok(routes[path]);
  });
  return { api: { GET } as unknown as ApiClient, asked };
}

afterEach(() => vi.useRealTimers());

describe('landingPath', () => {
  it('sends each role to its own portal', () => {
    expect(landingPath(me('ADMIN', []))).toBe('/admin');
    expect(landingPath(me(null, [membership('CLEANER')]))).toBe('/cleaner');
    expect(landingPath(me(null, []))).toBe('/');
  });
});

describe('warmPortal', () => {
  it("loads an admin's account, dashboard and property list, and the dashboard's code, before opening it", async () => {
    const { api, asked } = fakeApi({
      '/v1/me': me('ADMIN', []),
      '/v1/properties': { items: [] },
      '/v1/dashboard': { month: '2026-11' },
    });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const preload = vi.fn(() => Promise.resolve());
    await expect(warmPortal(qc, api, preload)).resolves.toBe('/admin');
    expect(preload).toHaveBeenCalledWith('/admin');
    expect(asked).toEqual(expect.arrayContaining(['/v1/me', '/v1/properties', '/v1/dashboard']));
  });

  it('still opens the page when something besides the account fails to load', async () => {
    const { api } = fakeApi({ '/v1/me': me('ADMIN', []) });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await expect(warmPortal(qc, api, () => Promise.reject(new Error('offline')))).resolves.toBe('/admin');
  });

  it("rejects when the account can't be loaded, so the portal can say why", async () => {
    const { api } = fakeApi({});
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await expect(warmPortal(qc, api, () => Promise.resolve())).rejects.toBeTruthy();
  });
});
