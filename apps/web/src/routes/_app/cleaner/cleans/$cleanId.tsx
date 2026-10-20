import { createFileRoute } from '@tanstack/react-router';
import { CleanPage } from '../../../../components/cleaner/clean-page';

/** One clean's walkthrough: start it, photograph every room before and after, check supplies, complete it. */
export const Route = createFileRoute('/_app/cleaner/cleans/$cleanId')({
  component: CleanRoute,
});

function CleanRoute() {
  const { cleanId } = Route.useParams();
  return <CleanPage cleanId={cleanId} />;
}
