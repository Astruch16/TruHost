import { useState, type ReactNode } from 'react';
import { createFileRoute, notFound } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import type { ApiClient } from '@truhost/api-client';
import type { Notification, SupplyCategory, SupplyItem } from '@truhost/shared';
import { NotificationsBell } from '../../components/shell/notifications-bell';
import { RestockList } from '../../components/supplies/restock-list';
import { SuppliesCard } from '../../components/supplies/supplies-card';
import { PageHeader } from '../../components/ui/page-header';
import { ApiContext, useApi } from '../../lib/api-context';
import { queries } from '../../lib/queries';

/**
 * Dev only: supplies as each role sees them, on an in-memory fake API (no sign-in), for review screenshots. One
 * fake for the whole page, so a cleaner's tap shows up in the owner's and admin's views and the restock list.
 */
export const Route = createFileRoute('/dev/supplies')({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound();
  },
  component: SuppliesPreview,
});

type Row = {
  id: string;
  propertyId: string;
  name: string;
  category: SupplyCategory;
  thresholdPct: number;
  level: number | null;
  hoursAgo?: number;
  archived?: boolean;
};

const PROPERTIES: Record<string, string> = { cedar: 'Cedar Cabin', loft: 'Seaside Loft', fresh: 'New Listing' };

const START: Row[] = [
  {
    id: 'a1',
    propertyId: 'cedar',
    name: 'Toilet paper',
    category: 'BATHROOM',
    thresholdPct: 25,
    level: 75,
    hoursAgo: 26,
  },
  { id: 'a2', propertyId: 'cedar', name: 'Shampoo', category: 'BATHROOM', thresholdPct: 25, level: 50, hoursAgo: 26 },
  { id: 'a3', propertyId: 'cedar', name: 'Body wash', category: 'BATHROOM', thresholdPct: 25, level: 25, hoursAgo: 26 },
  {
    id: 'a4',
    propertyId: 'cedar',
    name: 'Hand soap',
    category: 'BATHROOM',
    thresholdPct: 25,
    level: 100,
    hoursAgo: 26,
  },
  { id: 'a5', propertyId: 'cedar', name: 'Coffee pods', category: 'KITCHEN', thresholdPct: 30, level: 0, hoursAgo: 3 },
  {
    id: 'a6',
    propertyId: 'cedar',
    name: 'Paper towels',
    category: 'KITCHEN',
    thresholdPct: 25,
    level: 50,
    hoursAgo: 3,
  },
  { id: 'a7', propertyId: 'cedar', name: 'Condiments', category: 'KITCHEN', thresholdPct: 25, level: null },
  {
    id: 'a8',
    propertyId: 'cedar',
    name: 'Laundry detergent',
    category: 'LAUNDRY',
    thresholdPct: 25,
    level: 75,
    hoursAgo: 50,
  },
  {
    id: 'a9',
    propertyId: 'cedar',
    name: 'Dryer sheets',
    category: 'LAUNDRY',
    thresholdPct: 25,
    level: 25,
    hoursAgo: 50,
  },
  { id: 'b1', propertyId: 'loft', name: 'Toilet paper', category: 'BATHROOM', thresholdPct: 25, level: 0, hoursAgo: 5 },
  { id: 'b2', propertyId: 'loft', name: 'Dish soap', category: 'KITCHEN', thresholdPct: 20, level: 100, hoursAgo: 5 },
];

const stateOf = (level: number | null, threshold: number): SupplyItem['state'] =>
  level === null ? 'UNKNOWN' : level === 0 ? 'OUT' : level <= threshold ? 'LOW' : 'OK';

/** Answers the supplies routes the cards call, as the API would. */
function fakeSuppliesApi(): ApiClient {
  let rows = START.map((r) => ({ ...r }));
  let next = 1;
  const respond = (data: unknown, status = 200) =>
    Promise.resolve({ data, error: status >= 400 ? data : undefined, response: new Response(null, { status }) });
  const toItem = (r: Row, position: number): SupplyItem => ({
    id: r.id,
    propertyId: r.propertyId,
    name: r.name,
    category: r.category,
    thresholdPct: r.thresholdPct,
    position,
    levelPct: r.level,
    state: stateOf(r.level, r.thresholdPct),
    lastCheckedAt: r.level === null ? null : new Date(Date.now() - (r.hoursAgo ?? 0) * 3_600_000).toISOString(),
    archivedAt: null,
  });
  const list = (propertyId: string) => ({
    items: rows.filter((r) => r.propertyId === propertyId && !r.archived).map(toItem),
  });
  const api = {
    GET: (path: string, init?: { params?: { path?: { id?: string } } }) => {
      const id = init?.params?.path?.id ?? '';
      if (path === '/v1/properties/{id}/supplies') return respond(list(id));
      if (path === '/v1/supplies/restock') {
        const items = rows
          .filter((r) => !r.archived)
          .map((r, i) => {
            const item = toItem(r, i);
            // As the API: out or low now, or within a quarter of the restock point soon.
            const urgency =
              item.state === 'OUT' || item.state === 'LOW'
                ? item.state
                : item.state === 'OK' && item.levelPct! <= item.thresholdPct + 25
                  ? 'SOON'
                  : null;
            return { ...item, property: { id: r.propertyId, name: PROPERTIES[r.propertyId]! }, urgency };
          })
          .filter((i) => i.urgency !== null)
          .sort(
            (a, b) =>
              ['OUT', 'LOW', 'SOON'].indexOf(a.urgency!) - ['OUT', 'LOW', 'SOON'].indexOf(b.urgency!) ||
              a.levelPct! - a.thresholdPct - (b.levelPct! - b.thresholdPct),
          );
        return respond({ items });
      }
      if (path === '/v1/supply-items/{id}/history') {
        const r = rows.find((x) => x.id === id)!;
        return respond({
          items:
            r.level === null
              ? []
              : [
                  {
                    id: 'h1',
                    levelPct: r.level,
                    note: null,
                    reportedBy: { firstName: 'Maya', lastName: 'Chen' },
                    reportedAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),
                  },
                  {
                    id: 'h2',
                    levelPct: 100,
                    note: 'Restocked from the hall closet',
                    reportedBy: { firstName: 'Adam', lastName: 'Struch' },
                    reportedAt: '2026-10-04T17:30:00.000Z',
                  },
                ],
        });
      }
      return respond({ items: [] });
    },
    POST: (path: string, init: { params?: { path?: { id: string } }; body: Record<string, unknown> }) => {
      const id = init.params?.path?.id ?? '';
      if (path === '/v1/properties/{id}/supply-statuses') {
        for (const r of init.body.readings as { supplyItemId: string; levelPct: number }[]) {
          rows = rows.map((x) => (x.id === r.supplyItemId ? { ...x, level: r.levelPct, hoursAgo: 0 } : x));
        }
        return respond(list(id), 201);
      }
      if (path === '/v1/supply-items/{id}/archive') {
        rows = rows.map((x) => (x.id === id ? { ...x, archived: true } : x));
        return respond({});
      }
      const added = (path.endsWith('/bulk') ? (init.body.items as Partial<Row>[]) : [init.body as Partial<Row>]).map(
        (b): Row => ({
          id: `n${next++}`,
          propertyId: id,
          name: String(b.name),
          category: (b.category as SupplyCategory) ?? 'OTHER',
          thresholdPct: (b as { thresholdPct?: number }).thresholdPct ?? 25,
          level: null,
        }),
      );
      const taken = added.find((a) =>
        rows.some((r) => r.propertyId === id && !r.archived && r.name.toLowerCase() === a.name.toLowerCase()),
      );
      if (taken) {
        return respond(
          {
            code: 'SUPPLY_NAME_TAKEN',
            title: 'Conflict',
            status: 409,
            detail: `“${taken.name}” is already on this property’s supplies list.`,
          },
          409,
        );
      }
      rows = [...rows, ...added];
      return respond(path.endsWith('/bulk') ? list(id) : list(id).items.at(-1), 201);
    },
    PATCH: (
      _path: string,
      init: { params: { path: { id: string } }; body: Partial<Row> & { thresholdPct?: number } },
    ) => {
      rows = rows.map((x) => (x.id === init.params.path.id ? { ...x, ...init.body } : x));
      const r = rows.find((x) => x.id === init.params.path.id)!;
      return respond(toItem(r, 0));
    },
  };
  return api as unknown as ApiClient;
}

const NOTIFICATIONS: Notification[] = [
  {
    id: 'n1',
    kind: 'SUPPLY_OUT',
    title: 'Coffee pods has run out',
    body: 'Cedar Cabin · marked empty',
    property: { id: 'cedar', name: 'Cedar Cabin' },
    entityType: 'SupplyItem',
    entityId: 'a5',
    readAt: null,
    createdAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),
  },
  {
    id: 'n2',
    kind: 'SUPPLY_OUT',
    title: 'Toilet paper has run out',
    body: 'Seaside Loft · marked empty',
    property: { id: 'loft', name: 'Seaside Loft' },
    entityType: 'SupplyItem',
    entityId: 'b1',
    readAt: null,
    createdAt: new Date(Date.now() - 5 * 3_600_000).toISOString(),
  },
  {
    id: 'n3',
    kind: 'SUPPLY_LOW',
    title: 'Body wash is running low',
    body: 'Cedar Cabin · 25% left (restocked at 25%)',
    property: { id: 'cedar', name: 'Cedar Cabin' },
    entityType: 'SupplyItem',
    entityId: 'a3',
    readAt: '2026-10-12T10:00:00.000Z',
    createdAt: new Date(Date.now() - 26 * 3_600_000).toISOString(),
  },
];

function Restock() {
  const restock = useQuery(queries.restock(useApi()));
  return restock.data ? <RestockList items={restock.data.items} /> : null;
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

function SuppliesPreview() {
  const [api] = useState(fakeSuppliesApi);
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  return (
    <ApiContext.Provider value={api}>
      <QueryClientProvider client={client}>
        <div className="min-h-dvh bg-ground px-4 py-8 @2xl/content:px-8">
          <div className="mx-auto flex max-w-6xl flex-col gap-10">
            <PageHeader title="Supplies" description="Dev preview on a fake API: nothing is saved." />
            <Pane label="Cleaner (phone)" width="390px">
              <SuppliesCard propertyId="cedar" mode="report" />
            </Pane>
            <Pane label="Owner (side column)" width="360px">
              <SuppliesCard propertyId="cedar" mode="view" />
            </Pane>
            <Pane label="Admin (property page)">
              <SuppliesCard propertyId="cedar" mode="manage" wide />
            </Pane>
            <Pane label="Admin (new property)">
              <SuppliesCard propertyId="fresh" mode="manage" wide />
            </Pane>
            <Pane label="Supplies page">
              <Restock />
            </Pane>
            <Pane label="Bell">
              <div className="flex justify-end">
                <NotificationsBell unread={2} items={NOTIFICATIONS} onMarkAllRead={() => undefined} />
              </div>
            </Pane>
          </div>
        </div>
      </QueryClientProvider>
    </ApiContext.Provider>
  );
}
