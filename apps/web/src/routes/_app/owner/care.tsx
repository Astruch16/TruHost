import { createFileRoute } from '@tanstack/react-router';
import { OwnerCarePage } from '../../../components/owner-portal/owner-statements';

/** Care: clean photos, once cleaning is in TruHost (Phase 3). */
export const Route = createFileRoute('/_app/owner/care')({
  component: OwnerCarePage,
});
