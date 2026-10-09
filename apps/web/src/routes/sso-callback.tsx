import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { HandleSSOCallback } from '@clerk/react';
import { AuthCard } from '../components/auth/auth-card';
import { AuthFrame } from '../components/shell/auth-frame';
import { Spinner } from '../components/ui/spinner';

/** Where Google sends people back. Finishes the sign-in, or returns to the sign-in page with a reason. */
export const Route = createFileRoute('/sso-callback')({
  pendingMs: 0,
  component: SsoCallback,
});

function SsoCallback() {
  const navigate = useNavigate();
  return (
    <AuthFrame>
      <AuthCard title="Signing you in" subtitle="One moment…">
        <div className="flex justify-center py-2">
          <Spinner className="size-6 text-[#173F3A]" label="Signing you in" />
        </div>
        <HandleSSOCallback
          navigateToApp={({ decorateUrl }) => {
            const url = decorateUrl('/');
            if (url.startsWith('http')) window.location.href = url;
            else void navigate({ to: url, replace: true });
          }}
          // Needs more than Google can give (e.g. a device check): finish on the sign-in page.
          navigateToSignIn={() =>
            void navigate({ to: '/sign-in/$', params: { _splat: '' }, search: { error: 'google' }, replace: true })
          }
          // A Google address with no account would become a sign-up, which is invite only.
          navigateToSignUp={() =>
            void navigate({ to: '/sign-in/$', params: { _splat: '' }, search: { error: 'no-account' }, replace: true })
          }
        />
      </AuthCard>
    </AuthFrame>
  );
}
