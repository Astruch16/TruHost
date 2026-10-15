import { createFileRoute } from '@tanstack/react-router';
import { DamagePage } from '../../../components/damage/damage-page';
import { useScope } from '../../../lib/scope';

/**
 * Damage reports across the properties (or the one chosen in the switcher): what's open, what still needs a claim
 * filed (and by when), what's waiting on a claim, and what's resolved. Admins report damage and move reports on here.
 */
export const Route = createFileRoute('/_app/admin/damage')({
  component: Damage,
});

function Damage() {
  const { propertyId } = useScope();
  return <DamagePage propertyId={propertyId} />;
}
