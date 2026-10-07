import { useState } from 'react';
import { createFileRoute, Navigate, Outlet, useMatchRoute, useNavigate, useParams } from '@tanstack/react-router';
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
import { GuideContext } from '../lib/guide-context';
import { guideFromApi } from '../lib/guides';
import { initials, navItems, roleLabel } from '../lib/nav';
import { queries } from '../lib/queries';
import { readStoredScope, ScopeContext, storeScope } from '../lib/scope';

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
  const matchRoute = useMatchRoute();
  const { propertyId: routePropertyId } = useParams({ strict: false });
  const [scope, setScopeState] = useState(readStoredScope);
  const setScope = (id: string | null) => {
    setScopeState(id);
    storeScope(id);
  };
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
  const known = (id: string | null | undefined): id is string => !!id && list.some((p) => p.id === id);

  // Admins: the switcher narrows the admin pages (null = all properties); on a property's own page it follows it.
  // Owners and cleaners: the switcher takes them to that property's page.
  const adminScope = known(routePropertyId) ? routePropertyId : known(scope) ? scope : null;
  const memberSelected = [routePropertyId, scope].find(known) ?? list[0]?.id ?? null;
  const selectedId = isAdmin ? adminScope : memberSelected;

  const selectProperty = (id: string | null) => {
    setScope(id);
    if (!isAdmin) {
      if (id) void navigate({ to: '/properties/$propertyId', params: { propertyId: id } });
      return;
    }
    if (matchRoute({ to: '/admin/properties/$propertyId' })) {
      void (id
        ? navigate({ to: '/admin/properties/$propertyId', params: { propertyId: id } })
        : navigate({ to: '/admin/properties' }));
    }
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
      allowAllProperties={isAdmin}
      onSignOut={handleSignOut}
      onManageSignIn={() => openUserProfile({ appearance: clerkAppearance })}
    >
      <ScopeContext.Provider value={{ propertyId: selectedId, setPropertyId: setScope }}>
        <GuideContext.Provider value={guideFromApi(user.guide)}>
          <Outlet />
        </GuideContext.Provider>
      </ScopeContext.Provider>
    </AppShell>
  );
}
