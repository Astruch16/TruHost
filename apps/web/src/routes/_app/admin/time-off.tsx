import { createFileRoute } from '@tanstack/react-router';
import { AdminTimeOffPage } from '../../../components/time-off/admin-time-off-page';

/** Cleaners' time off: approve or decline requests, and see the cleans they'd miss. */
export const Route = createFileRoute('/_app/admin/time-off')({
  component: AdminTimeOffPage,
});
