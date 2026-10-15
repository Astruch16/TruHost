import { createFileRoute } from '@tanstack/react-router';
import { StatementsPage } from '../../../../components/statements/statements-page';
import { addMonths, monthKey } from '../../../../lib/months';
import { monthSearch } from '../../../../lib/scope';

/** Owner statements by month (last month by default: statements are for months that are over). */
export const Route = createFileRoute('/_app/admin/statements/')({
  validateSearch: monthSearch,
  component: Statements,
});

function Statements() {
  const navigate = Route.useNavigate();
  const month = Route.useSearch().month ?? addMonths(monthKey(), -1);
  return <StatementsPage month={month} onMonthChange={(m) => void navigate({ search: { month: m } })} />;
}
