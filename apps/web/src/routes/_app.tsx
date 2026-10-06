import { useState } from 'react';
import { createFileRoute, Navigate, Outlet, useNavigate, useParams } from '@tanstack/react-router';
import { useAuth, useClerk } from '@clerk/react';
import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@truhost/api-client';
import { AppShell } from '../components/shell/app-shell';
import { AuthFrame } from '../components/shell/auth-frame';
import { ErrorAlert } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { LoadingBlock } from '../components/ui/skeleton';
import { useApi } from '../lib/api-context';
import { clerkAppearance } from '../lib/clerk-appearance';
import { initials, navItems, roleLabel } from '../lib/nav';
import { queries } from '../lib/queries';
import { readSelectedProperty, writeSelectedProperty } from '../lib/selected-property';

/** Everything behind sign-in. Our API (not Clerk) decides who the user is and what they see. */
export const Route = createFileRoute('/_app')({
  component: AppLayout,
});

function AppLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <FullPageLoading />;
  if (!isSignedIn) return <Navigate to="/sign-in/$" params={{ _splat: '' }} />;
  return <SignedInShell />;
}

function FullPageLoading() {
  return (
    <div className="mx-auto max-w-3xl p-8">
      <LoadingBlock label="Loading TruHost" />
    </div>
  );
}

function SignedInShell() {
  const api = useApi();
  const { signOut, openUserProfile } = useClerk();
  const navigate = useNavigate();
  const me = useQuery(queries.me(api));
  const properties = useQuery({ ...queries.properties(api), enabled: me.isSuccess });
  const { propertyId: routePropertyId } = useParams({ strict: false });
  const [picked, setPicked] = useState(readSelectedProperty);
  const handleSignOut = () => void signOut({ redirectUrl: '/sign-in' });

  if (me.isPending) return <FullPageLoading />;
  if (me.error) {
    const notInvited = me.error instanceof ApiError && me.error.problem.code === 'NOT_INVITED';
    return (
      <AuthFrame
        title={notInvited ? 'No access yet' : 'We couldn’t load your account'}
        description={
          notInvited
            ? 'TruHost is invite-only. Ask a TruHost admin to invite this email address, then sign in again.'
            : undefined
        }
      >
        {!notInvited && <ErrorAlert error={me.error} />}
        <Button variant="secondary" block onClick={handleSignOut}>
          Sign out
        </Button>
      </AuthFrame>
    );
  }

  const user = me.data;
  const isAdmin = user.staffRole === 'ADMIN';
  const list = properties.data?.items ?? [];
  const selectedId = [routePropertyId, picked].find((id) => id && list.some((p) => p.id === id)) ?? list[0]?.id ?? null;

  const selectProperty = (id: string) => {
    setPicked(id);
    writeSelectedProperty(id);
    void (isAdmin
      ? navigate({ to: '/admin/properties/$propertyId', params: { propertyId: id } })
      : navigate({ to: '/properties/$propertyId', params: { propertyId: id } }));
  };

  return (
    <AppShell
      nav={navItems(user)}
      user={{
        name: `${user.firstName} ${user.lastName}`,
        initials: initials(user.firstName, user.lastName),
        role: roleLabel(user),
        email: user.email,
      }}
      properties={list}
      selectedPropertyId={selectedId}
      onSelectProperty={selectProperty}
      onSignOut={handleSignOut}
      onManageSignIn={() => openUserProfile({ appearance: clerkAppearance })}
    >
      <Outlet />
    </AppShell>
  );
}
