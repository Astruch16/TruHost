import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TriangleAlert } from 'lucide-react';
import { useApi } from '../../lib/api-context';
import { todayIso } from '../../lib/dates';
import { queries } from '../../lib/queries';
import { DamageIllustration } from '../illustrations/damage';
import { LoadError } from '../ui/alert';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { EmptyState } from '../ui/empty-state';
import { Skeleton } from '../ui/skeleton';
import { DamageList } from './damage-list';
import { DamageReportDialog } from './damage-report-dialog';
import { ReportDamageDialog } from './report-damage-dialog';

/**
 * A property's damage reports, as a card on its pages. Admins and cleaners can report damage here; owners see what's
 * been reported (the API leaves out drafts that aren't theirs).
 */
export function DamageCard({
  propertyId,
  canReport,
  className,
}: {
  propertyId: string;
  /** Show "Report damage" (admins and cleaners; the API decides who may). */
  canReport: boolean;
  className?: string;
}) {
  const reports = useQuery(queries.propertyDamage(useApi(), propertyId));
  const [reporting, setReporting] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const items = reports.data?.items ?? [];
  const openCount = items.filter((r) => r.status !== 'RESOLVED').length;

  return (
    <Card
      title="Damage reports"
      description={
        items.length === 0
          ? 'Guest damage, with photos, for a claim with the booking site.'
          : `${openCount} open · ${items.length - openCount} resolved`
      }
      className={className}
      actions={
        canReport ? (
          <Button variant="secondary" size="sm" onClick={() => setReporting(true)}>
            <TriangleAlert aria-hidden className="size-4" /> Report damage
          </Button>
        ) : undefined
      }
    >
      {reports.error ? (
        <LoadError what="damage reports" onRetry={() => void reports.refetch()} retrying={reports.isFetching} />
      ) : !reports.data ? (
        <Skeleton className="h-20" />
      ) : items.length === 0 ? (
        <EmptyState size="compact" illustration={<DamageIllustration />} title="No damage reported">
          {canReport
            ? 'If a guest leaves damage, report it here with photos, the day you found it and the stay.'
            : 'Anything a cleaner or TruHost reports shows up here, with photos.'}
        </EmptyState>
      ) : (
        <DamageList items={items} today={todayIso()} showProperty={false} onOpen={setOpen} />
      )}
      {reporting && (
        <ReportDamageDialog
          open
          onOpenChange={(o) => !o && setReporting(false)}
          properties={[{ id: propertyId, name: '' }]}
          initialPropertyId={propertyId}
        />
      )}
      {open && <DamageReportDialog reportId={open} open onOpenChange={(o) => !o && setOpen(null)} />}
    </Card>
  );
}
