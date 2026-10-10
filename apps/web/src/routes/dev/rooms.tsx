import { useState } from 'react';
import { createFileRoute, notFound } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ApiClient } from '@truhost/api-client';
import {
  duplicateRoomName,
  nextRoomNumber,
  normalizeRoomLabel,
  roomDisplayNames,
  roomTypeNeedsLabel,
  type Room,
  type RoomType,
} from '@truhost/shared';
import { RoomsCard } from '../../components/rooms/rooms-card';
import { PageHeader } from '../../components/ui/page-header';
import { ApiContext } from '../../lib/api-context';

/** Dev only: the rooms card on an in-memory fake API (no sign-in), for review screenshots and trying it out. */
export const Route = createFileRoute('/dev/rooms')({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound();
  },
  component: RoomsPreview,
});

type Row = { id: string; type: RoomType; label: string | null; number: number; position: number; archived?: boolean };

/** Answers the rooms routes the card calls, with the API's naming and duplicate rules. */
function fakeRoomsApi(start: Row[]): ApiClient {
  let rows = start;
  let next = 1;
  const respond = (data: unknown, status = 200) =>
    Promise.resolve({ data, error: status >= 400 ? data : undefined, response: new Response(null, { status }) });
  const active = (list: Row[]) => list.filter((r) => !r.archived);
  const items = () => {
    const names = roomDisplayNames(active(rows));
    return rows.map(({ archived, ...r }): Room => ({
      ...r,
      propertyId: 'p',
      archivedAt: archived ? '2026-10-01T00:00:00.000Z' : null,
      displayName: names.get(r.id) ?? roomDisplayNames([r]).get(r.id)!,
    }));
  };
  const clash = (candidate: Row[]) => duplicateRoomName(roomDisplayNames(active(candidate)).values());
  const taken = (name: string) =>
    respond(
      { code: 'ROOM_NAME_TAKEN', title: 'Conflict', status: 409, detail: `There’s already a room called “${name}”.` },
      409,
    );
  const api = {
    GET: () => respond({ items: items(), nextCursor: null }), // the card asks for deleted rooms too
    POST: (
      path: string,
      init: {
        body?: { type: RoomType; label?: string | null; rooms?: { type: RoomType }[] };
        params: { path: { id: string } };
      },
    ) => {
      if (path.endsWith('/archive')) {
        // Deleted rooms stay (with their numbers); the others keep theirs.
        rows = rows.map((r) => (r.id === init.params.path.id ? { ...r, archived: true } : r));
        return respond({});
      }
      const held: Row[] = [...rows];
      const added = (init.body!.rooms ?? [init.body!]).map((r, i) => {
        const room: Row = {
          id: `r${next++}`,
          type: r.type,
          label: normalizeRoomLabel((r as { label?: string | null }).label),
          number: nextRoomNumber(held, r.type),
          position: rows.length + i,
        };
        held.push(room);
        return room;
      });
      const name = clash([...rows, ...added]);
      if (name) return taken(name);
      rows = [...rows, ...added];
      return respond(path.endsWith('/bulk') ? { items: items(), nextCursor: null } : items().at(-1), 201);
    },
    PATCH: (
      _path: string,
      init: { params: { path: { id: string } }; body: { type: RoomType; label: string | null } },
    ) => {
      const changed = rows.map((r) =>
        r.id === init.params.path.id
          ? {
              ...r,
              type: init.body.type,
              label: normalizeRoomLabel(init.body.label),
              number:
                init.body.type === r.type
                  ? r.number
                  : nextRoomNumber(
                      rows.filter((x) => x.id !== r.id),
                      init.body.type,
                    ),
            }
          : r,
      );
      const edited = changed.find((r) => r.id === init.params.path.id)!;
      if (roomTypeNeedsLabel(edited.type) && !edited.label)
        return respond({ code: 'ROOM_LABEL_REQUIRED', status: 422 }, 422);
      const name = clash(changed);
      if (name) return taken(name);
      rows = changed;
      return respond(items().find((r) => r.id === edited.id));
    },
    PUT: (_path: string, init: { body: { roomIds: string[] } }) => {
      const byId = new Map(rows.map((r) => [r.id, r]));
      rows = [
        ...init.body.roomIds.map((id, i) => ({ ...byId.get(id)!, position: i })),
        ...rows.filter((r) => r.archived),
      ];
      return respond({ items: items().filter((r) => !r.archivedAt), nextCursor: null });
    },
  };
  return api as unknown as ApiClient;
}

const SAMPLE: Row[] = [
  { id: 's1', type: 'ENTRY', label: null, number: 1, position: 0 },
  { id: 's2', type: 'LIVING', label: null, number: 1, position: 1 },
  { id: 's3', type: 'KITCHEN', label: null, number: 1, position: 2 },
  { id: 's4', type: 'BEDROOM', label: 'Primary', number: 1, position: 3 },
  { id: 's5', type: 'BATHROOM', label: 'Ensuite', number: 1, position: 4 },
  { id: 's6', type: 'BEDROOM', label: null, number: 2, position: 5 },
  { id: 's7', type: 'BEDROOM', label: null, number: 3, position: 6 },
  { id: 's8', type: 'BATHROOM', label: null, number: 2, position: 7 },
  { id: 's9', type: 'PATIO_DECK', label: null, number: 1, position: 8 },
  { id: 's10', type: 'OTHER', label: 'Bunk room', number: 1, position: 9 },
];

function Preview({
  rows,
  layout,
}: {
  rows: Row[];
  layout: { bedrooms: number; bathrooms: number; halfBathrooms: number | null };
}) {
  const [api] = useState(() => fakeRoomsApi(rows));
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  return (
    <ApiContext.Provider value={api}>
      <QueryClientProvider client={client}>
        <RoomsCard propertyId="p" layout={layout} />
      </QueryClientProvider>
    </ApiContext.Provider>
  );
}

function RoomsPreview() {
  return (
    <div className="@container/content min-h-dvh bg-ground px-4 py-8 @2xl/content:px-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <PageHeader title="Rooms" description="Dev preview on a fake API: nothing is saved." />
        <section aria-label="New property" className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted">A new property (3 bed, 2 bath, 1 half bath)</h2>
          <Preview rows={[]} layout={{ bedrooms: 3, bathrooms: 2, halfBathrooms: 1 }} />
        </section>
        <section aria-label="Set-up property" className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted">A property with rooms</h2>
          <Preview rows={SAMPLE} layout={{ bedrooms: 3, bathrooms: 2, halfBathrooms: null }} />
        </section>
      </div>
    </div>
  );
}
