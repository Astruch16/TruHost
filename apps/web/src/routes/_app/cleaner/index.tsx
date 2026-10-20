import { createFileRoute } from '@tanstack/react-router';
import { CleanerSchedulePage } from '../../../components/cleaner/schedule-page';

/** A cleaner's schedule: today's cleans, what's coming up, and the last few done. */
export const Route = createFileRoute('/_app/cleaner/')({
  component: CleanerSchedulePage,
});
