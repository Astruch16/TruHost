import { createFileRoute } from '@tanstack/react-router';
import { SecuritySettings } from '../../../components/settings/security-section';

export const Route = createFileRoute('/_app/account/security')({
  component: SecuritySettings,
});
