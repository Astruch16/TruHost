import { useState, type ReactNode } from 'react';
import { createFileRoute, notFound } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ApiClient } from '@truhost/api-client';
import type { TimeOffRequest } from '@truhost/shared';
import { AdminTimeOffPage } from '../../components/time-off/admin-time-off-page';
import { ApiContext } from '../../lib/api-context';

/** Dev only: the admin time off page on a fake API (no sign-in), for review screenshots. */
export const Route = createFileRoute('/dev/time-off')({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound();
  },
  component: TimeOffPreview,
});

const base = {
  decidedBy: null,
  decidedAt: null,
  decisionNote: null,
  cancelledAt: null,
  createdAt: '2026-10-24T18:00:00Z',
  conflicts: [],
  can: { cancel: false, decide: true },
} satisfies Partial<TimeOffRequest>;

const REQUESTS: TimeOffRequest[] = [
  {
    ...base,
    id: 't1',
    cleaner: { id: 'u1', firstName: 'Casey', lastName: 'Clean' },
    startDate: '2026-12-21',
    endDate: '2026-12-27',
    days: 7,
    reason: 'HOLIDAY',
    note: 'Visiting family over Christmas.',
    status: 'PENDING',
    conflicts: [
      { cleanId: 'c1', date: '2026-12-22', property: { id: 'p1', name: 'Fixture Cabin' } },
      { cleanId: 'c2', date: '2026-12-26', property: { id: 'p2', name: 'Fixture Suite' } },
    ],
  },
  {
    ...base,
    id: 't2',
    cleaner: { id: 'u2', firstName: 'Jordan', lastName: 'Tidy' },
    startDate: '2026-11-06',
    endDate: '2026-11-06',
    days: 1,
    reason: 'OTHER_WORK',
    note: null,
    status: 'PENDING',
  },
];

function fakeApi(): ApiClient {
  const respond = (data: unknown, status = 200) =>
    Promise.resolve({ data, error: undefined, response: new Response(null, { status }) });
  return {
    GET: (path: string) => respond({ items: path === '/v1/time-off' ? REQUESTS : [] }),
    POST: () => respond({ ...REQUESTS[0], status: 'APPROVED' }),
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

function TimeOffPreview() {
  const [api] = useState(fakeApi);
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  return (
    <ApiContext.Provider value={api}>
      <QueryClientProvider client={client}>
        <div className="min-h-dvh bg-ground px-4 py-8 @2xl/content:px-8">
          <div className="mx-auto flex max-w-6xl flex-col gap-10">
            <Pane label="Time off (admin)">
              <AdminTimeOffPage />
            </Pane>
            <Pane label="Time off (admin, phone)" width="390px">
              <AdminTimeOffPage />
            </Pane>
          </div>
        </div>
      </QueryClientProvider>
    </ApiContext.Provider>
  );
}
