import type { DashboardYear } from '../../lib/api-types';
import type { TrendMetric, YearQuery } from '../../lib/trends';
import { Dialog } from '../ui/dialog';
import { TrendsChart } from './trends-chart';

/** A figure's trend, opened from a Year to date card: the same line chart as the Trends view, larger. */
export function TrendDialog({
  metric,
  year,
  yearQuery,
  scopeName,
  onClose,
}: {
  metric: TrendMetric | null;
  year: DashboardYear;
  yearQuery: YearQuery;
  scopeName: string | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={metric !== null}
      onOpenChange={(open) => !open && onClose()}
      title="Trends"
      description={`${scopeName ?? 'All properties'}, month by month. Step through months and years, or pick another figure.`}
      size="xl"
    >
      {metric && <TrendsChart key={metric} year={year} yearQuery={yearQuery} initialMetric={metric} />}
    </Dialog>
  );
}
