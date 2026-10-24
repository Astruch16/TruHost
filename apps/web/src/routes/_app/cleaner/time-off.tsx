import { createFileRoute } from '@tanstack/react-router';
import { CleanerTimeOffPage } from '../../../components/time-off/cleaner-time-off-page';

/** A cleaner's time off: ask for days to be kept free, and see what TruHost decided. */
export const Route = createFileRoute('/_app/cleaner/time-off')({
  component: CleanerTimeOffPage,
});
