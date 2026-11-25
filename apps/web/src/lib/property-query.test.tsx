import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ApiClient } from '@truhost/api-client';
import { ApiContext } from './api-context';
import { useProperty } from './property-query';

const listed = { id: 'p1', name: 'Cedar Cabin (from the list)' };
const fetched = { id: 'p1', name: 'Cedar Cabin' };

function setup() {
  let resolve: (v: unknown) => void = () => undefined;
  const GET = vi.fn(() => new Promise((r) => (resolve = r)));
  const qc = new QueryClient();
  qc.setQueryData(['properties', { includeArchived: false }], { items: [listed] });
  // Not a list: one property's rooms, whose items have ids too.
  qc.setQueryData(['properties', 'p9', 'rooms', { includeArchived: false }], { items: [{ id: 'p1', name: 'Room' }] });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ApiContext.Provider value={{ GET } as unknown as ApiClient}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </ApiContext.Provider>
  );
  return { wrapper, resolve: (v: unknown) => resolve({ data: v, response: new Response(null, { status: 200 }) }) };
}

describe('useProperty', () => {
  it('shows the property from a loaded list at once, then its own copy', async () => {
    const { wrapper, resolve } = setup();
    const { result } = renderHook(() => useProperty('p1'), { wrapper });
    expect(result.current.data).toEqual(listed);
    expect(result.current.isPlaceholderData).toBe(true);
    resolve(fetched);
    await waitFor(() => expect(result.current.data).toEqual(fetched));
    expect(result.current.isPlaceholderData).toBe(false);
  });

  it('has nothing to show for a property in no loaded list', () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useProperty('p2'), { wrapper });
    expect(result.current.data).toBeUndefined();
  });
});
