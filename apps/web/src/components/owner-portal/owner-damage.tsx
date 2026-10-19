import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '../../lib/api-context';
import { todayIso } from '../../lib/dates';
import { queries } from '../../lib/queries';
import { switchingStyles } from '../../lib/styles';
import { DamageList } from '../damage/damage-list';
import { DamageReportDialog } from '../damage/damage-report-dialog';
import { DamageIllustration } from '../illustrations/damage';
import { LoadError } from '../ui/alert';
import { Card } from '../ui/card';
import { EmptyState } from '../ui/empty-state';
import { PageHeader } from '../ui/page-header';
import { Skeleton } from '../ui/skeleton';

/**
 * Damage at the owner's properties: what TruHost and the cleaners reported, with photos, the stay it's linked to
 * (dates and channel, no guest details) and where each claim stands. Read-only.
 */
export function OwnerDamagePage({ propertyId }: { propertyId: string | null }) {
  const api = useApi();
  const reports = useQuery(queries.ownerDamage(api, propertyId));
  const [open, setOpen] = useState<string | null>(null);
  const items = reports.data?.items ?? [];
  const many = new Set(items.map((r) => r.property.id)).size > 1;

  return (
    <>
      <PageHeader
        title="Damage"
        description="Damage found at your property after a stay, with photos, and how each claim with the booking site is going."
      />
      {reports.error ? (
        <LoadError what="damage reports" onRetry={() => void reports.refetch()} retrying={reports.isFetching} />
      ) : !reports.data ? (
        <Skeleton className="h-64 rounded-card" />
      ) : (
        <Card className={switchingStyles(reports.isPlaceholderData)}>
          {items.length === 0 ? (
            <EmptyState size="compact" illustration={<DamageIllustration />} title="No damage reported">
              If a cleaner or TruHost finds damage after a stay, it shows up here with photos, and you’ll get an email.
            </EmptyState>
          ) : (
            <DamageList items={items} today={todayIso()} showProperty={many} onOpen={setOpen} />
          )}
        </Card>
      )}
      {open && <DamageReportDialog reportId={open} open owner onOpenChange={(o) => !o && setOpen(null)} />}
    </>
  );
}
