import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, unwrap } from '@truhost/api-client';
import type { CleanSummary } from '@truhost/shared';
import { Clock, DoorOpen } from 'lucide-react';
import { useApi } from '../../lib/api-context';
import { cleanOccasion, freeFrom, readyBy } from '../../lib/cleans';
import { cx } from '../../lib/cx';
import { dayLabel } from '../../lib/dashboard-format';
import { formatCents } from '../../lib/money';
import { ErrorAlert } from '../ui/alert';
import { Button } from '../ui/button';

/**
 * Open cleans at the properties a cleaner works: no one has them yet, and the first to book one gets it (the API
 * makes sure only one cleaner can). Each shows when it is, the window, and what it pays. Nothing open, nothing shown.
 */
export function OpenCleans({ cleans, colors }: { cleans: readonly CleanSummary[]; colors: Map<string, string> }) {
  const [booked, setBooked] = useState<CleanSummary | null>(null);
  if (cleans.length === 0 && !booked) return null;
  return (
    <section
      aria-labelledby="open-cleans"
      className="col-span-full rounded-card border border-blue-deep/20 bg-blue-tint/30 p-4 @2xl/content:p-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="open-cleans" className="text-lg font-bold text-ink">
            Open cleans
          </h2>
          <p className="text-sm text-muted">
            No one has these yet. Book one and it’s yours: it goes on your schedule and TruHost is told.
          </p>
        </div>
        <p className="figure text-sm font-semibold text-muted">{cleans.length} open</p>
      </div>
      {booked && (
        <p role="status" className="mt-3 rounded-inner bg-sage-tint/60 px-3.5 py-2.5 text-sm text-sage-deep">
          Booked: <strong>{booked.property.name}</strong>, {dayLabel(booked.scheduledDate)}. It’s on your schedule.
        </p>
      )}
      {cleans.length > 0 && (
        <ul className="mt-4 grid grid-cols-1 gap-3 @2xl/content:grid-cols-2 @5xl/content:grid-cols-3">
          {cleans.map((c) => (
            <OpenClean key={c.id} clean={c} color={colors.get(c.property.id)} onBooked={setBooked} />
          ))}
        </ul>
      )}
    </section>
  );
}

function OpenClean({
  clean: c,
  color,
  onBooked,
}: {
  clean: CleanSummary;
  color?: string;
  onBooked: (c: CleanSummary) => void;
}) {
  const api = useApi();
  const qc = useQueryClient();
  const book = useMutation({
    mutationFn: () => unwrap(api.POST('/v1/cleans/{id}/book', { params: { path: { id: c.id } } })),
    onSuccess: (data) => {
      onBooked(data);
      void qc.invalidateQueries({ queryKey: ['cleans'] });
    },
    // Someone else got there first: the list drops it.
    onError: (e) => {
      if (e instanceof ApiError && e.status === 409) void qc.invalidateQueries({ queryKey: ['cleans'] });
    },
  });
  const from = freeFrom(c);
  const taken = book.error instanceof ApiError && book.error.problem.code === 'CLEAN_TAKEN';
  return (
    <li
      aria-label={`${c.property.name}, ${dayLabel(c.scheduledDate)}`}
      className="flex flex-col overflow-hidden rounded-inner border border-line-soft bg-surface"
    >
      <span aria-hidden className={cx('block h-1', color ?? 'bg-blue-deep')} />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">
              {dayLabel(c.scheduledDate)} · {cleanOccasion(c)}
            </p>
            <Link
              to="/cleaner/cleans/$cleanId"
              params={{ cleanId: c.id }}
              className="mt-0.5 block truncate font-bold text-ink hover:underline"
            >
              {c.property.name}
            </Link>
            <p className="text-sm text-muted">{c.property.city}</p>
          </div>
          {c.cleanerPayCents ? (
            <p className="figure shrink-0 text-lg font-bold text-ink">{formatCents(c.cleanerPayCents)}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span className="inline-flex items-center gap-1.5 text-muted">
            <DoorOpen aria-hidden className="size-4" />
            {from ?? 'Free any time'}
          </span>
          <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
            <Clock aria-hidden className="size-4 text-muted" />
            {readyBy(c)}
          </span>
        </div>
        {book.error &&
          (taken ? (
            <p role="alert" className="text-sm text-danger-deep">
              Another cleaner has just booked this one.
            </p>
          ) : (
            <ErrorAlert error={book.error} />
          ))}
        <div className="mt-auto">
          <Button onClick={() => book.mutate()} loading={book.isPending} disabled={taken} className="w-full sm:w-auto">
            Book this clean
          </Button>
        </div>
      </div>
    </li>
  );
}
