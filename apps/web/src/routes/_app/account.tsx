import { createFileRoute, Outlet } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { SettingsShell } from '../../components/settings/settings-shell';
import { useApi } from '../../lib/api-context';
import { queries } from '../../lib/queries';

/** Settings: the profile banner, then the section nav beside (on phones, above) the open section. */
export const Route = createFileRoute('/_app/account')({
  component: SettingsLayout,
});

function SettingsLayout() {
  const me = useQuery(queries.me(useApi()));
  return (
    <SettingsShell me={me.data}>
      <Outlet />
    </SettingsShell>
  );
}
