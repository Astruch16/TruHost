import { createFileRoute } from '@tanstack/react-router';
import { PreferenceSettings } from '../../../components/settings/preferences-section';

export const Route = createFileRoute('/_app/account/preferences')({
  component: PreferenceSettings,
});
