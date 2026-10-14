import { useState, type ReactNode } from 'react';
import { createFileRoute, notFound } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ApiClient } from '@truhost/api-client';
import { DamageCard } from '../../components/damage/damage-card';
import { DamagePage } from '../../components/damage/damage-page';
import { ApiContext } from '../../lib/api-context';
import { DEV_DAMAGE } from '../../lib/dev-damage-fixtures';

/** Dev only: damage reports on a fake API (no sign-in), for review screenshots. */
export const Route = createFileRoute('/dev/damage')({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound();
  },
  component: DamagePreview,
});

function fakeApi(): ApiClient {
  const respond = (data: unknown, status = 200) =>
    Promise.resolve({ data, error: undefined, response: new Response(null, { status }) });
  // Lists don't carry the photos (the API leaves them for the single report).
  const strip = (r: (typeof DEV_DAMAGE)[number]) => ({ ...r, photos: undefined });
  return {
    GET: (path: string, init?: { params?: { path?: { id?: string } } }) => {
      const id = init?.params?.path?.id ?? '';
      if (path === '/v1/damage-reports') return respond({ items: DEV_DAMAGE.map(strip) });
      if (path === '/v1/properties/{id}/damage-reports')
        return respond({ items: DEV_DAMAGE.filter((r) => r.property.id === id).map(strip) });
      if (path === '/v1/damage-reports/{id}') return respond(DEV_DAMAGE.find((r) => r.id === id));
      if (path === '/v1/properties')
        return respond({
          items: [
            { id: 'p1', name: 'Fixture Suite' },
            { id: 'p2', name: 'Fixture Cabin' },
          ],
        });
      if (path === '/v1/properties/{id}/rooms')
        return respond({
          items: [
            { id: 'r1', displayName: 'Living room' },
            { id: 'r3', displayName: 'Kitchen' },
            { id: 'r2', displayName: 'Bathroom' },
          ],
        });
      if (path === '/v1/properties/{id}/damage-report-stays')
        return respond({
          items: [
            { id: 'b3', guestName: 'Leila', checkInDate: '2026-10-10', checkOutDate: '2026-10-12', channel: 'VRBO' },
            {
              id: 'b1',
              guestName: 'Jordan Guest',
              checkInDate: '2026-10-01',
              checkOutDate: '2026-10-04',
              channel: 'AIRBNB',
            },
          ],
        });
      return respond({ items: [] });
    },
    POST: () => respond(DEV_DAMAGE[0]),
  } as unknown as ApiClient;
}

function Pane({ label, width, children }: { label: string; width?: string; children: ReactNode }) {
  return (
    <section aria-label={label} data-pane={label} className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-muted">{label}</h2>
      <div className="@container/content" style={width ? { maxWidth: width } : undefined}>
        {children}
      </div>
    </section>
  );
}

function DamagePreview() {
  const [api] = useState(fakeApi);
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  return (
    <ApiContext.Provider value={api}>
      <QueryClientProvider client={client}>
        <div className="min-h-dvh bg-ground px-4 py-8 @2xl/content:px-8">
          <div className="mx-auto flex max-w-6xl flex-col gap-10">
            <Pane label="Damage page (admin)">
              <DamagePage propertyId={null} />
            </Pane>
            <Pane label="Property card (cleaner)" width="760px">
              <DamageCard propertyId="p1" canReport />
            </Pane>
            <Pane label="Property card (owner)" width="760px">
              <DamageCard propertyId="p2" canReport={false} />
            </Pane>
          </div>
        </div>
      </QueryClientProvider>
    </ApiContext.Provider>
  );
}
