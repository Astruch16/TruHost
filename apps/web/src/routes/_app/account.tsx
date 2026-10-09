import { createFileRoute, Outlet } from '@tanstack/react-router';
import { SettingsNav } from '../../components/settings/settings-nav';
import { PageHeader } from '../../components/ui/page-header';

/** Settings: the section nav beside (on phones, above) the open section. */
export const Route = createFileRoute('/_app/account')({
  component: SettingsLayout,
});

function SettingsLayout() {
  return (
    <>
      <PageHeader title="Settings" description="Your profile, how you sign in, and how TruHost works for you." />
      <div className="grid grid-cols-1 gap-6 @4xl/content:grid-cols-[15rem_minmax(0,1fr)] @4xl/content:gap-10">
        <div className="min-w-0 @4xl/content:sticky @4xl/content:top-6 @4xl/content:self-start">
          <SettingsNav />
        </div>
        <div className="flex max-w-3xl min-w-0 flex-col gap-6">
          <Outlet />
        </div>
      </div>
    </>
  );
}
