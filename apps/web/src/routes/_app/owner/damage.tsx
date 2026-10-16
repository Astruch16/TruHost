import { createFileRoute } from '@tanstack/react-router';
import { OwnerDamagePage } from '../../../components/owner-portal/owner-damage';
import { useScope } from '../../../lib/scope';

/** Damage reported at the owner's properties. */
export const Route = createFileRoute('/_app/owner/damage')({
  component: OwnerDamage,
});

function OwnerDamage() {
  return <OwnerDamagePage propertyId={useScope().propertyId} />;
}
