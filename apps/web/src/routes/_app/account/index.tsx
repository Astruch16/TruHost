import { createFileRoute } from '@tanstack/react-router';
import { ProfileSettings } from '../../../components/settings/profile-section';

export const Route = createFileRoute('/_app/account/')({
  component: ProfileSettings,
});
