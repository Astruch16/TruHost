import { createFileRoute } from '@tanstack/react-router';
import { OwnerStatementPage } from '../../../../components/owner-portal/owner-statements';

/** One released statement (where the release email links). */
export const Route = createFileRoute('/_app/owner/statements/$statementId')({
  component: OwnerStatement,
});

function OwnerStatement() {
  const { statementId } = Route.useParams();
  return <OwnerStatementPage key={statementId} statementId={statementId} />;
}
