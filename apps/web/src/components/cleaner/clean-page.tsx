import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, unwrap } from '@truhost/api-client';
import { CLEAN_STATUS_LABELS, type Clean, type MissingCleanPhotos } from '@truhost/shared';
import { ArrowLeft, Clock, DoorOpen, Play } from 'lucide-react';
import { useApi } from '../../lib/api-context';
import { CLEAN_STATUS_TONE, cleanOccasion, freeFrom, readyBy } from '../../lib/cleans';
import { cx } from '../../lib/cx';
import { dayLabel } from '../../lib/dashboard-format';
import { formatCents } from '../../lib/money';
import { queries } from '../../lib/queries';
import { NotAvailable } from '../shell/not-available';
import { ErrorAlert } from '../ui/alert';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Pill } from '../ui/pill';
import { Skeleton } from '../ui/skeleton';
import { SuccessNotice } from '../ui/success-notice';
import { CleanChecklist, CompletedClean } from './clean-checklist';

/**
 * One clean, as its cleaner works it on a phone: when the place is free and when it must be ready, then (once started
 * on its day) its checklist (CleanChecklist): before photos, damage, a stock count, after photos and "Clean finished",
 * which tells TruHost and the owner. Finishing is a milestone: the celebrating guide. A finished clean shows what was
 * done.
 */
export function CleanPage({ cleanId }: { cleanId: string }) {
  const api = useApi();
  const qc = useQueryClient();
  const query = useQuery(queries.clean(api, cleanId));
  const [justCompleted, setJustCompleted] = useState(false);
  const [missing, setMissing] = useState<MissingCleanPhotos | null>(null);
  const store = (data: Clean) => {
    qc.setQueryData(queries.clean(api, cleanId).queryKey, data);
    void qc.invalidateQueries({ queryKey: ['cleans', 'list'] });
  };
  const start = useMutation({
    mutationFn: () => unwrap(api.POST('/v1/cleans/{id}/start', { params: { path: { id: cleanId } } })),
    onSuccess: store,
  });
  const complete = useMutation({
    mutationFn: () => unwrap(api.POST('/v1/cleans/{id}/complete', { params: { path: { id: cleanId } } })),
    onSuccess: (data) => {
      store(data);
      setMissing(null);
      setJustCompleted(true);
      window.scrollTo({ top: 0 });
    },
    onError: (e) => {
      const list = e instanceof ApiError ? (e.problem as { missing?: MissingCleanPhotos }).missing : undefined;
      setMissing(list ?? null);
    },
  });

  if (query.error) {
    return query.error instanceof ApiError && query.error.status === 404 ? (
      <NotAvailable />
    ) : (
      <ErrorAlert error={query.error} />
    );
  }
  if (!query.data) {
    return (
      <div role="status" aria-label="Loading the clean" className="flex flex-col gap-4">
        <Skeleton className="h-10 w-2/3 rounded-inner" />
        <Skeleton className="h-40 rounded-card" />
        <Skeleton className="h-64 rounded-card" />
      </div>
    );
  }
  const c = query.data;
  const from = freeFrom(c);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <Link
        to="/cleaner"
        className="inline-flex w-fit items-center gap-1.5 rounded-control text-sm font-semibold text-primary hover:underline"
      >
        <ArrowLeft aria-hidden className="size-4" /> Your schedule
      </Link>

      {justCompleted && c.status === 'COMPLETE' && (
        <SuccessNotice title="Clean finished. Nice work.">
          TruHost and the owner have been told {c.property.name} is ready for guests.
        </SuccessNotice>
      )}

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.12em] text-muted uppercase">
            {dayLabel(c.scheduledDate)} · {cleanOccasion(c)}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink @2xl/content:text-3xl">{c.property.name}</h1>
          <p className="mt-0.5 text-muted">{c.property.city}</p>
        </div>
        <Pill tone={CLEAN_STATUS_TONE[c.status]}>{CLEAN_STATUS_LABELS[c.status]}</Pill>
      </header>

      <Card>
        <dl className="grid grid-cols-2 gap-4 @xl/content:grid-cols-[1fr_1fr_auto]">
          <Fact
            icon={<DoorOpen className="size-4" />}
            label="Free from"
            value={from ? from.replace('Free from ', '') : 'Any time'}
          />
          <Fact
            icon={<Clock className="size-4" />}
            label="Ready by"
            value={readyBy(c).replace('Ready by ', '')}
            strong
          />
          {/* Pay, once TruHost has set it (a clean at $0 means it hasn't been). */}
          {c.cleanerPayCents ? <Fact label="You earn" value={formatCents(c.cleanerPayCents)} figure /> : null}
        </dl>
        {c.notes && <p className="mt-4 rounded-inner bg-ground px-3.5 py-3 text-sm text-ink">{c.notes}</p>}
      </Card>

      {c.status === 'SCHEDULED' && (
        <Card>
          {c.can.start ? (
            <div className="flex flex-col gap-3">
              <p className="text-ink">
                When you arrive, start the clean. A checklist then takes you through it: photos of every room as you
                find it, any damage, a stock count, photos once it’s clean, and finishing.
              </p>
              <ErrorAlert error={start.error} />
              <Button onClick={() => start.mutate()} loading={start.isPending} className="min-h-12 w-full sm:w-auto">
                <Play aria-hidden className="size-4" /> Start the clean
              </Button>
            </div>
          ) : (
            <p className="text-muted">
              {c.assignedCleaner
                ? c.scheduledDate > c.today
                  ? `You can start this clean on ${dayLabel(c.scheduledDate)}.`
                  : `This clean was for ${dayLabel(c.scheduledDate)} and can’t be started now. Ask TruHost if it still needs doing.`
                : 'No one is assigned to this clean yet.'}
            </p>
          )}
        </Card>
      )}

      {c.status === 'CANCELLED' && (
        <Card>
          <p className="font-semibold text-ink">This clean was cancelled.</p>
          {c.cancelReason && <p className="mt-1 text-muted">{c.cancelReason}</p>}
        </Card>
      )}

      {c.status === 'IN_PROGRESS' && (
        <CleanChecklist
          clean={c}
          onUpdated={store}
          onFinish={() => complete.mutate()}
          finishing={complete.isPending}
          finishError={complete.error}
          missing={missing}
        />
      )}
      {c.status === 'COMPLETE' && <CompletedClean clean={c} />}
    </div>
  );
}

function Fact({
  icon,
  label,
  value,
  strong = false,
  figure = false,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  strong?: boolean;
  figure?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-xs font-semibold tracking-[0.08em] text-muted uppercase">
        {icon && <span aria-hidden>{icon}</span>}
        {label}
      </dt>
      <dd className={cx('mt-1 text-lg text-ink', (strong || figure) && 'font-bold', figure && 'figure')}>{value}</dd>
    </div>
  );
}
