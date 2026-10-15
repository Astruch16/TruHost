import { createFileRoute } from '@tanstack/react-router';
import { StatementDetail } from '../../../../components/statements/statement-detail';

/**
 * One owner statement. `?correcting=<statement id>` opens the adjustment form, set to correct that (finalized)
 * statement: where "Add a correction next month" lands.
 */
export const Route = createFileRoute('/_app/admin/statements/$statementId')({
  validateSearch: (search: Record<string, unknown>): { correcting?: string } =>
    typeof search.correcting === 'string' ? { correcting: search.correcting } : {},
  component: StatementPage,
});

function StatementPage() {
  const { statementId } = Route.useParams();
  const { correcting } = Route.useSearch();
  return <StatementDetail key={statementId} statementId={statementId} correcting={correcting} />;
}
