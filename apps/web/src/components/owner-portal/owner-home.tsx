import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Mail } from 'lucide-react';
import { useApi } from '../../lib/api-context';
import { cx } from '../../lib/cx';
import { greeting } from '../../lib/owner';
import { usePrefetchOwnerScopes } from '../../lib/owner-prefetch';
import { queries } from '../../lib/queries';
import { switchingStyles } from '../../lib/styles';
import { openFile } from '../../lib/upload';
import { ErrorAlert, LoadError } from '../ui/alert';
import { Card } from '../ui/card';
import { PageHeader } from '../ui/page-header';
import { Skeleton } from '../ui/skeleton';
import { ComingUpCard, MonthEarningsHero, NetByMonthChart, ThisMonthCard } from './home-cards';
import { GoodToKnowCard } from './good-to-know';
import { OwnerSuppliesCard } from './supplies-card';
import { YearToDateCard } from './year-card';

/**
 * The owner's home: the latest released statement, this month so far (estimated), the year to date, net by month,
 * the next stays and anything worth knowing. `propertyId` is the switcher's choice (null: every property they own).
 */
export function OwnerHomePage({
  firstName,
  propertyId,
  propertyName,
  month,
  onMonthChange,
}: {
  firstName: string;
  propertyId: string | null;
  /** The chosen property's name, or null for all of them. */
  propertyName: string | null;
  /** The month the earnings card shows; null: the latest released one (or this month before the first release). */
  month: string | null;
  onMonthChange: (month: string) => void;
}) {
  const api = useApi();
  const home = useQuery(queries.ownerHome(api, propertyId));
  const config = useQuery(queries.config(api));
  const supplies = useQuery(queries.ownerSupplies(api, propertyId));
  const owned = useQuery(queries.ownerProperties(api));
  // Switching property: the page stays on screen, softly dimmed, until the next property's figures arrive.
  const switching = home.isPlaceholderData || supplies.isPlaceholderData;
  usePrefetchOwnerScopes(
    api,
    owned.data?.items.map((p) => p.id) ?? [],
    propertyId,
    home.isSuccess && !home.isPlaceholderData,
  );
  const [actionError, setActionError] = useState<unknown>(null);
  const h = home.data;
  const shown = month ?? h?.latest?.month ?? h?.month ?? null;
  const earnings = useQuery({
    ...queries.ownerMonth(api, shown ?? '', propertyId),
    enabled: shown !== null,
  });
  const many = (h?.properties ?? 1) > 1;

  return (
    <>
      <PageHeader
        eyebrow={greeting()}
        title={firstName}
        description={propertyName ? `Here’s how ${propertyName} is doing.` : 'Here’s how your properties are doing.'}
      />
      {home.error ? (
        <LoadError what="your home page" onRetry={() => void home.refetch()} retrying={home.isFetching} />
      ) : !h ? (
        <div role="status" aria-label="Loading your home page" className="flex flex-col gap-6">
          <Skeleton className="h-60 rounded-card" />
          <div className="grid gap-6 @5xl/content:grid-cols-[minmax(0,1fr)_24rem]">
            <div className="flex flex-col gap-6">
              <Skeleton className="h-52 rounded-card" />
              <div className="grid grid-cols-2 gap-3 @2xl/content:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-28 rounded-2xl" />
                ))}
              </div>
            </div>
            <Skeleton className="h-80 rounded-card" />
          </div>
        </div>
      ) : (
        <div className={cx('flex flex-col gap-6', switchingStyles(switching))} aria-busy={switching || undefined}>
          <ErrorAlert error={actionError} />
          <MonthEarningsHero
            month={shown ?? h.month}
            onMonthChange={onMonthChange}
            data={earnings.data}
            loading={earnings.isFetching}
            firstStatementExpected={h.latest ? null : h.thisMonth.statementExpected}
          />
          <div className="grid items-start gap-6 @5xl/content:grid-cols-[minmax(0,1fr)_24rem]">
            <div className="flex min-w-0 flex-col gap-6">
              <ThisMonthCard m={h.thisMonth} />
              <YearToDateCard ytd={h.yearToDate} month={h.month} />
              <NetByMonthChart months={h.netByMonth} />
              {supplies.error ? (
                <Card title="Supplies">
                  <LoadError what="supplies" onRetry={() => void supplies.refetch()} retrying={supplies.isFetching} />
                </Card>
              ) : supplies.data ? (
                <OwnerSuppliesCard data={supplies.data} />
              ) : (
                <Skeleton className="h-64 rounded-card" />
              )}
            </div>
            <div className="flex flex-col gap-6">
              <ComingUpCard items={h.comingUp} showProperty={many} />
              {h.goodToKnow.length > 0 && (
                <GoodToKnowCard
                  items={h.goodToKnow}
                  showProperty={many}
                  onViewReceipt={(id) => void openFile(api, id).catch(setActionError)}
                />
              )}
              <Card title="Questions about your property?" description="TruHost reads every message.">
                <a
                  href={`mailto:${config.data?.contactEmail ?? ''}?subject=${encodeURIComponent(propertyName ? `About ${propertyName}` : 'About my properties')}`}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-line bg-surface px-5 text-sm font-semibold text-ink transition-colors hover:bg-ground"
                  aria-disabled={!config.data}
                >
                  <Mail aria-hidden className="size-4" /> Message TruHost
                </a>
              </Card>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
