import { createFileRoute } from '@tanstack/react-router';
import { NotificationSettings } from '../../../components/settings/notifications-section';

export const Route = createFileRoute('/_app/account/notifications')({
  component: NotificationSettings,
});
