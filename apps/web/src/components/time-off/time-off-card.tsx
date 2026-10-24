import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@truhost/api-client';
import { TIME_OFF_REASON_LABELS, TIME_OFF_STATUS_LABELS, type TimeOffRequest } from '@truhost/shared';
import { TriangleAlert } from 'lucide-react';
import { useApi } from '../../lib/api-context';
import { cx } from '../../lib/cx';
import { dayLabel } from '../../lib/dashboard-format';
import { TIME_OFF_TONE, timeOffDates } from '../../lib/time-off';
import { Avatar } from '../ui/avatar';
import { ErrorAlert } from '../ui/alert';
import { Button } from '../ui/button';
import { Field } from '../ui/field';
import { Textarea } from '../ui/input';
import { Pill } from '../ui/pill';

/**
 * One time off request: the days, why, its note and where it stands; the cleaner's cleans in those dates (to
 * reassign); TruHost's note once decided. What the caller can do comes from the API: its cleaner cancels, admins
 * approve or decline.
 */
export function TimeOffCard({ request: r, showCleaner = false }: { request: TimeOffRequest; showCleaner?: boolean }) {
  const name = `${r.cleaner.firstName} ${r.cleaner.lastName}`.trim();
  // Admins (shown the cleaner) are who it's waiting for.
  const status = showCleaner && r.status === 'PENDING' ? 'Waiting for you' : TIME_OFF_STATUS_LABELS[r.status];
  return (
    <li
      aria-label={`${showCleaner ? `${name}: ` : ''}${timeOffDates(r)}, ${status}`}
      className={cx(
        'flex flex-col gap-3 rounded-card border bg-surface p-4 @2xl/content:p-5',
        r.status === 'PENDING' ? 'border-amber-mid/50' : 'border-line-soft',
        (r.status === 'CANCELLED' || r.status === 'DECLINED') && 'opacity-75',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {showCleaner && (
            <Avatar
              url={null}
              initials={`${r.cleaner.firstName[0] ?? ''}${r.cleaner.lastName[0] ?? ''}`}
              className="size-10 shrink-0 text-sm"
            />
          )}
          <div className="min-w-0">
            {showCleaner && <p className="text-sm font-semibold text-muted">{name}</p>}
            <p className={cx('font-bold text-ink', r.status === 'CANCELLED' && 'line-through decoration-muted')}>
              {timeOffDates(r)}
            </p>
            <p className="text-sm text-muted">
              {r.days} day{r.days === 1 ? '' : 's'} · {TIME_OFF_REASON_LABELS[r.reason]}
            </p>
          </div>
        </div>
        <Pill tone={TIME_OFF_TONE[r.status]}>{status}</Pill>
      </div>
      {r.note && <p className="rounded-inner bg-ground px-3.5 py-2.5 text-sm text-ink">“{r.note}”</p>}
      {r.conflicts.length > 0 && (
        <div className="rounded-inner bg-amber-tint/60 px-3.5 py-3 text-sm text-amber-deep">
          <p className="flex items-center gap-1.5 font-semibold">
            <TriangleAlert aria-hidden className="size-4" />
            {r.conflicts.length} clean{r.conflicts.length === 1 ? '' : 's'} in these dates
            {showCleaner ? ' to reassign' : ''}
          </p>
          <ul className="mt-1 flex flex-col gap-0.5 pl-5.5">
            {r.conflicts.map((c) => (
              <li key={c.cleanId}>
                {dayLabel(c.date)} · {c.property.name}
              </li>
            ))}
          </ul>
          {!showCleaner && <p className="mt-1 text-xs">TruHost will find someone else for these.</p>}
        </div>
      )}
      {r.decisionNote && (
        <p className="text-sm text-muted">
          <span className="font-semibold text-ink">{r.decidedBy ? `${r.decidedBy.firstName}:` : 'TruHost:'}</span>{' '}
          {r.decisionNote}
        </p>
      )}
      {r.can.decide && <Decide request={r} />}
      {r.can.cancel && <CancelRequest request={r} />}
    </li>
  );
}

function useRefresh() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['time-off'] });
}

/** Admins: approve or decline, with an optional note for the cleaner. */
function Decide({ request: r }: { request: TimeOffRequest }) {
  const api = useApi();
  const refresh = useRefresh();
  const [note, setNote] = useState('');
  const decide = useMutation({
    mutationFn: (status: 'APPROVED' | 'DECLINED') =>
      unwrap(
        api.POST('/v1/time-off/{id}/decision', {
          params: { path: { id: r.id } },
          body: { status, note: note.trim() || null },
        }),
      ),
    onSuccess: refresh,
  });
  return (
    <div className="flex flex-col gap-3 border-t border-line-soft pt-3">
      <Field label="Note for the cleaner" hint="Optional">
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={1} maxLength={500} />
      </Field>
      <ErrorAlert error={decide.error} />
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => decide.mutate('APPROVED')}
          loading={decide.isPending && decide.variables === 'APPROVED'}
          disabled={decide.isPending}
        >
          Approve
        </Button>
        <Button
          variant="secondary"
          onClick={() => decide.mutate('DECLINED')}
          loading={decide.isPending && decide.variables === 'DECLINED'}
          disabled={decide.isPending}
        >
          Decline
        </Button>
      </div>
    </div>
  );
}

/** Its cleaner: withdraw it (asked once more before it goes). */
function CancelRequest({ request: r }: { request: TimeOffRequest }) {
  const api = useApi();
  const refresh = useRefresh();
  const [asking, setAsking] = useState(false);
  const cancel = useMutation({
    mutationFn: () => unwrap(api.POST('/v1/time-off/{id}/cancel', { params: { path: { id: r.id } } })),
    onSuccess: refresh,
  });
  return (
    <div className="flex flex-col gap-2">
      <ErrorAlert error={cancel.error} />
      {asking ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-ink">
            {r.status === 'APPROVED' ? 'Cancel this time off? You’ll be available again.' : 'Withdraw this request?'}
          </p>
          <Button variant="danger" size="sm" onClick={() => cancel.mutate()} loading={cancel.isPending}>
            Yes, cancel it
          </Button>
          <Button variant="quiet" size="sm" onClick={() => setAsking(false)} disabled={cancel.isPending}>
            Keep it
          </Button>
        </div>
      ) : (
        <div>
          <Button variant="secondary" size="sm" onClick={() => setAsking(true)}>
            {r.status === 'APPROVED' ? 'Cancel time off' : 'Withdraw request'}
          </Button>
        </div>
      )}
    </div>
  );
}
