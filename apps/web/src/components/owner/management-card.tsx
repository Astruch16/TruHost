import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@truhost/api-client';
import { OWN_PROPERTY_PLAN_ID } from '@truhost/shared';
import { House } from 'lucide-react';
import { FeeIcon, OwnPropertyIcon } from '../illustrations/statement-icons';
import { useApi } from '../../lib/api-context';
import { formatBps } from '../../lib/format';
import { monthLabel } from '../../lib/months';
import { queries } from '../../lib/queries';
import { LoadError } from '../ui/alert';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { ConfirmDialog } from '../ui/dialog';
import { Skeleton } from '../ui/skeleton';

/**
 * The management plan in force and its fee. On a property an admin owns themselves, they can switch it to the 0% Own
 * property plan for every month so far (a correction: TruHost staff don't pay themselves a fee).
 */
export function ManagementCard({ propertyId, canMarkOwn }: { propertyId: string; canMarkOwn: boolean }) {
  const api = useApi();
  const qc = useQueryClient();
  const plan = useQuery(queries.propertyPlan(api, propertyId));
  const [confirming, setConfirming] = useState(false);
  const correct = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST('/v1/properties/{id}/plan/correct', {
          params: { path: { id: propertyId } },
          body: { planId: OWN_PROPERTY_PLAN_ID },
        }),
      ),
    onSuccess: async (data) => {
      qc.setQueryData(queries.propertyPlan(api, propertyId).queryKey, data);
      // Every month's figures change: summaries and the dashboard.
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['summary', propertyId] }),
        qc.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
      setConfirming(false);
    },
  });
  const current = plan.data?.current ?? null;
  const own = current?.plan.id === OWN_PROPERTY_PLAN_ID;

  return (
    <Card title="Management fee">
      {plan.error ? (
        <LoadError what="the plan" onRetry={() => void plan.refetch()} retrying={plan.isFetching} />
      ) : plan.isPending ? (
        <Skeleton className="h-16" />
      ) : own ? (
        <div className="flex items-start gap-3">
          <OwnPropertyIcon className="shrink-0" />
          <div>
            <p className="font-semibold text-ink">No management fee</p>
            <p className="text-sm text-muted">This is your own property, so TruHost doesn’t take a fee.</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <FeeIcon className="shrink-0" />
            {current ? (
              <div>
                <p className="font-semibold text-ink">
                  {current.plan.name} · <span className="figure">{formatBps(current.plan.managementFeeBps)}</span>
                </p>
                <p className="text-sm text-muted">
                  Of each month’s gross revenue, since {monthLabel(current.effectiveFrom.slice(0, 7))}.
                </p>
              </div>
            ) : (
              <div>
                <p className="font-semibold text-ink">No plan yet</p>
                <p className="text-sm text-muted">TruHost will set the management plan.</p>
              </div>
            )}
          </div>
          {canMarkOwn && (
            <Button variant="secondary" size="sm" className="self-start" onClick={() => setConfirming(true)}>
              <House aria-hidden className="size-4" /> No fee: it’s my own property
            </Button>
          )}
        </div>
      )}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Stop charging a fee on your own property?"
        description="Every month so far switches to the Own property plan (0%), so the management fee comes off this property’s figures. The change is recorded in the audit log."
        confirmLabel="Switch to no fee"
        pending={correct.isPending}
        error={correct.error}
        onConfirm={() => correct.mutate()}
      />
    </Card>
  );
}
