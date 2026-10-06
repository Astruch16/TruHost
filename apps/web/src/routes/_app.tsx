import { createFileRoute, Link, Navigate, Outlet } from '@tanstack/react-router';
import { SignOutButton, useAuth, UserButton } from '@clerk/react';
import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@truhost/api-client';
import { Button, ErrorBanner, Loading } from '../components/ui';
import { useApi } from '../lib/api-context';
import { queries } from '../lib/queries';

/** Everything behind sign-in. Our API (not Clerk) decides who the user is and what they see. */
export const Route = createFileRoute('/_app')({
  component: AppLayout,
});

function AppLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <Loading />;
  if (!isSignedIn) return <Navigate to="/sign-in/$" params={{ _splat: '' }} />;
  return <SignedInShell />;
}

function SignedInShell() {
  const api = useApi();
  const me = useQuery(queries.me(api));

  if (me.isPending) return <Loading />;
  if (me.error) {
    const notInvited = me.error instanceof ApiError && me.error.problem.code === 'NOT_INVITED';
    return (
      <main className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h1 className="text-xl font-semibold">{notInvited ? 'No access yet' : 'Could not load your account'}</h1>
        {notInvited ? (
          <p className="text-sm text-slate-600">
            TruHost is invite-only. Ask a TruHost admin to invite this email address, then sign in again.
          </p>
        ) : (
          <ErrorBanner error={me.error} />
        )}
        <SignOutButton>
          <Button variant="secondary">Sign out</Button>
        </SignOutButton>
      </main>
    );
  }

  const isAdmin = me.data.staffRole === 'ADMIN';
  const navLink =
    'rounded-md px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 [&.active]:bg-slate-900 [&.active]:text-white';

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-2">
          <Link to="/" className="mr-2 font-semibold">
            TruHost
          </Link>
          <nav className="flex flex-1 gap-1 overflow-x-auto">
            {me.data.memberships.length > 0 && (
              <Link to="/properties" className={navLink}>
                My properties
              </Link>
            )}
            {isAdmin && (
              <>
                <Link to="/admin/properties" className={navLink}>
                  Properties
                </Link>
                <Link to="/admin/team" className={navLink}>
                  Team
                </Link>
                <Link to="/admin/plans" className={navLink}>
                  Plans
                </Link>
              </>
            )}
          </nav>
          <Link to="/account" className={navLink}>
            Account
          </Link>
          <UserButton />
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 p-4">
        <Outlet />
      </main>
    </>
  );
}
