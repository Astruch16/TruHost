import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import type { ApiClient } from '@truhost/api-client';
import { usePrefetchAdjacentMonths } from './month-prefetch';
import { queries } from './queries';

/** A fake API whose summary answers with the requested property and month, after `delay` ms. */
function fakeApi(delay = 0) {
  const GET = vi.fn(
    (_path: string, init: { params: { path: { id: string }; query: { month: string } } }) =>
      new Promise((resolve) =>
        setTimeout(
          () =>
            resolve({
              data: { label: `${init.params.path.id} ${init.params.query.month}` },
              response: new Response(null, { status: 200 }),
            }),
          delay,
        ),
      ),
  );
  return { api: { GET } as unknown as ApiClient, GET };
}

function Summary({ api, propertyId, month }: { api: ApiClient; propertyId: string; month: string }) {
  const summary = useQuery(queries.propertySummary(api, propertyId, month));
  usePrefetchAdjacentMonths(month, (m) => queries.propertySummary(api, propertyId, m), summary.isSuccess);
  if (!summary.data) return <p>loading</p>;
  const { label } = summary.data as unknown as { label: string };
  return <p data-updating={summary.isPlaceholderData}>{label}</p>;
}

function Harness({ api }: { api: ApiClient }) {
  const [month, setMonth] = useState('2026-10');
  const [propertyId, setPropertyId] = useState('a');
  return (
    <>
      <button onClick={() => setMonth('2026-11')}>next</button>
      <button onClick={() => setMonth('2026-12')}>next again</button>
      <button onClick={() => setPropertyId('b')}>other property</button>
      <Summary api={api} propertyId={propertyId} month={month} />
    </>
  );
}

const renderWith = (api: ApiClient) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: false } } })}>
      <Harness api={api} />
    </QueryClientProvider>,
  );

const months = (GET: ReturnType<typeof fakeApi>['GET']) => GET.mock.calls.map((c) => c[1].params.query.month);

describe('stepping between months', () => {
  it('loads the months either side in the background, so the first step is instant', async () => {
    const { api, GET } = fakeApi();
    renderWith(api);
    expect(await screen.findByText('a 2026-10')).toBeInTheDocument();
    await waitFor(() => expect(months(GET)).toEqual(['2026-10', '2026-09', '2026-11']));

    act(() => screen.getByText('next').click());
    // Already loaded: shown at once, not as a placeholder, with no new request for it.
    expect(screen.getByText('a 2026-11')).toHaveAttribute('data-updating', 'false');
    await waitFor(() => expect(months(GET)).toContain('2026-12'));
    expect(months(GET).filter((m) => m === '2026-11')).toHaveLength(1);
  });

  it('keeps the month on screen (dimmed) while a month that isn’t loaded yet arrives, never a skeleton', async () => {
    const { api } = fakeApi(50);
    renderWith(api);
    expect(await screen.findByText('a 2026-10')).toBeInTheDocument();
    act(() => screen.getByText('next again').click()); // two months on: not prefetched
    expect(screen.queryByText('loading')).not.toBeInTheDocument();
    expect(screen.getByText('a 2026-10')).toHaveAttribute('data-updating', 'true');
    expect(await screen.findByText('a 2026-12')).toHaveAttribute('data-updating', 'false');
  });

  it('never shows another property’s figures while switching property', async () => {
    const { api } = fakeApi(50);
    renderWith(api);
    expect(await screen.findByText('a 2026-10')).toBeInTheDocument();
    act(() => screen.getByText('other property').click());
    expect(screen.getByText('loading')).toBeInTheDocument();
    expect(await screen.findByText('b 2026-10')).toBeInTheDocument();
  });
});
