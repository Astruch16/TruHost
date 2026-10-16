import { createFileRoute } from '@tanstack/react-router';
import { OwnerStatementsPage } from '../../../../components/owner-portal/owner-statements';
import { useScope } from '../../../../lib/scope';

/** The owner's released statements. */
export const Route = createFileRoute('/_app/owner/statements/')({
  component: OwnerStatements,
});

function OwnerStatements() {
  return <OwnerStatementsPage propertyId={useScope().propertyId} />;
}
