import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ApiClient } from '@truhost/api-client';
import type { ReactNode } from 'react';
import { ApiContext } from './api-context';
import { usePrefetchCalendar } from './calendar-prefetch';
import { ScopeContext } from './scope';

const ok = (data: unknown) => Promise.resolve({ data, response: new Response(null, { status: 200 }) });

describe('usePrefetchCalendar', () => {
  it("loads this month's properties, bookings and figures for the chosen property", async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-18T12:00:00'));
    const GET = vi.fn(() => ok({ items: [] }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ApiContext.Provider value={{ GET } as unknown as ApiClient}>
        <QueryClientProvider client={client}>
          <ScopeContext.Provider value={{ propertyId: 'p1', setPropertyId: () => undefined }}>
            {children}
          </ScopeContext.Provider>
        </QueryClientProvider>
      </ApiContext.Provider>
    );
    const { result } = renderHook(() => usePrefetchCalendar(), { wrapper });
    await act(async () => result.current());
    const keys = client
      .getQueryCache()
      .getAll()
      .map((q) => q.queryKey);
    expect(keys).toEqual(
      expect.arrayContaining([
        ['properties', { includeArchived: false }],
        ['bookings', expect.objectContaining({ propertyId: 'p1' })],
        ['dashboard', '2026-11', 'p1'],
      ]),
    );
    vi.useRealTimers();
  });

  it('does nothing outside the app (no API or query client)', () => {
    const { result } = renderHook(() => usePrefetchCalendar());
    expect(() => result.current()).not.toThrow();
  });
});
