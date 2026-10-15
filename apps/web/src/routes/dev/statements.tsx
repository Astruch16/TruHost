import { useState } from 'react';
import { createFileRoute, notFound } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ApiClient } from '@truhost/api-client';
import { StatementDetail } from '../../components/statements/statement-detail';
import { StatementsPage } from '../../components/statements/statements-page';
import { ApiContext } from '../../lib/api-context';
import type { Statement } from '../../lib/api-types';
import {
  CEDAR_DRAFT,
  CEDAR_FINALIZED,
  CEDAR_RELEASED,
  SEASIDE_DRAFT,
  SEPTEMBER,
} from '../../lib/dev-statement-fixtures';

const VIEWS = ['list', 'blocked', 'draft', 'pending', 'finalized', 'released'] as const;
type View = (typeof VIEWS)[number];

/**
 * Dev only: owner statements on a fake API (no sign-in), for review screenshots. `?view=` picks the page: the month
 * list, a draft that can't be finalized yet (`blocked`), one that can (`draft`), one with a stay waiting on its
 * payout (`pending`), `finalized` or `released`. Actions
 * move the fake statement along (finalize, release, adjustments). The real pages are /admin/statements.
 */
export const Route = createFileRoute('/dev/statements')({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound();
  },
  validateSearch: (search: Record<string, unknown>): { view: View } => ({
    view: VIEWS.includes(search.view as View) ? (search.view as View) : 'list',
  }),
  component: StatementsPreview,
});

const START: Record<View, Statement> = {
  list: CEDAR_DRAFT,
  blocked: SEASIDE_DRAFT,
  draft: CEDAR_DRAFT,
  pending: {
    ...CEDAR_DRAFT,
    pendingPayouts: [
      {
        bookingId: 'b6',
        checkInDate: '2026-09-29',
        checkOutDate: '2026-09-30',
        channel: 'AIRBNB',
        guestName: 'Late Payer',
      },
    ],
  },
  finalized: CEDAR_FINALIZED,
  released: CEDAR_RELEASED,
};

/** A minimal one-page PDF, so the preview dialog has something to show. */
const PDF = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj
trailer<</Root 1 0 R>>
%%EOF`;

function fakeApi(view: View): ApiClient {
  let current: Statement = START[view];
  const respond = (data: unknown, status = 200) =>
    Promise.resolve({ data, error: status >= 400 ? data : undefined, response: new Response(null, { status }) });
  const byId = (id: string) => (id === SEASIDE_DRAFT.id ? (view === 'blocked' ? current : SEASIDE_DRAFT) : current);
  return {
    GET: (path: string, init?: { params?: { path?: { id?: string } } }) => {
      const id = init?.params?.path?.id ?? '';
      if (path === '/v1/statements') return respond(SEPTEMBER);
      if (path === '/v1/statements/{id}') return respond(byId(id));
      if (path === '/v1/statements/{id}/preview') return respond(new Blob([PDF], { type: 'application/pdf' }));
      if (path === '/v1/files/{id}/url') return respond({ url: 'about:blank', expiresAt: '2026-10-15T20:00:00.000Z' });
      return respond({ items: [] });
    },
    POST: (path: string, init: { body: Record<string, unknown> }) => {
      if (path === '/v1/statements/{id}/finalize') current = { ...CEDAR_FINALIZED, adjustments: current.adjustments };
      if (path === '/v1/statements/{id}/release') {
        current = {
          ...CEDAR_RELEASED,
          released: {
            ...CEDAR_RELEASED.released!,
            on: String(init.body.releasedOn),
            paymentReference: (init.body.paymentReference as string | null) ?? null,
          },
        };
      }
      if (path === '/v1/statements/{id}/adjustments') {
        const amountCents = init.body.amountCents as number;
        current = {
          ...current,
          totals: {
            ...current.totals,
            adjustmentsCents: current.totals.adjustmentsCents + amountCents,
            netCents: current.totals.netCents + amountCents,
          },
          adjustments: [
            ...current.adjustments,
            {
              id: `a${current.adjustments.length + 1}`,
              amountCents,
              reason: String(init.body.reason),
              corrects: null,
              createdAt: new Date().toISOString(),
              createdBy: { id: 'u-admin', firstName: 'Adam', lastName: 'Struch' },
              voidedAt: null,
              voidReason: null,
            },
          ],
        };
      }
      if (path === '/v1/statements/generate') return respond({ ...SEPTEMBER, created: 1 });
      return respond(current);
    },
  } as unknown as ApiClient;
}

function StatementsPreview() {
  const { view } = Route.useSearch();
  const [api] = useState(() => fakeApi(view));
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  const [month, setMonth] = useState('2026-09');
  return (
    <ApiContext.Provider value={api}>
      <QueryClientProvider client={client}>
        <div className="@container/content min-h-dvh bg-ground px-4 py-6 @2xl/content:px-8 @2xl/content:py-8">
          <div className="mx-auto max-w-[1680px]">
            {view === 'list' ? (
              <StatementsPage month={month} onMonthChange={setMonth} />
            ) : (
              <StatementDetail statementId={START[view].id} />
            )}
          </div>
        </div>
      </QueryClientProvider>
    </ApiContext.Provider>
  );
}
