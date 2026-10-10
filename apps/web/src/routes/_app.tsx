import { useEffect, useState } from 'react';
import { createFileRoute, Navigate, Outlet, useMatchRoute, useNavigate, useParams } from '@tanstack/react-router';
import { useAuth, useClerk, useUser } from '@clerk/react';
import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@truhost/api-client';
import { AuthButton, AuthCard } from '../components/auth/auth-card';
import { AppShell } from '../components/shell/app-shell';
import { NotAvailable } from '../components/shell/not-available';
import { PortalLoading } from '../components/shell/portal-loading';
import { AuthFrame } from '../components/shell/auth-frame';
import { ErrorAlert } from '../components/ui/alert';
import { useApi } from '../lib/api-context';
import { GuideContext } from '../lib/guide-context';
import { guideFromApi } from '../lib/guides';
import { propertyPath } from '../lib/access';
import { initials, navItems, roleLabel } from '../lib/nav';
import { applyMotion, PreferencesContext } from '../lib/preferences';
import { queries } from '../lib/queries';
import { readStoredScope, ScopeContext, storeScope } from '../lib/scope';

/** Everything behind sign-in. Our API (not Clerk) decides who the user is and what they see. */
export const Route = createFileRoute('/_app')({
  pendingMs: 0, // first visit: show the portal outline straight away, never a blank screen
  component: AppLayout,
  // Unknown addresses inside the portal: inside the shell, with the way home.
  notFoundComponent: () => <NotAvailable />,
});

function AppLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <PortalLoading />;
  if (!isSignedIn) return <Navigate to="/sign-in/$" params={{ _splat: '' }} />;
  return <SignedInShell />;
}

function SignedInShell() {
  const api = useApi();
  const { signOut } = useClerk();
  const { user: clerkUser } = useUser();
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
  const signedInAs = clerkUser?.primaryEmailAddress?.emailAddress ?? null;
  const motion = me.data?.motion ?? 'SYSTEM';
  useEffect(() => applyMotion(motion), [motion]);

  if (me.isPending) return <PortalLoading onRetry={() => void me.refetch()} />;
  if (me.error) {
    const notInvited = me.error instanceof ApiError && me.error.problem.code === 'NOT_INVITED';
    return (
      <AuthFrame>
        <AuthCard
          title={notInvited ? 'No access yet' : 'We couldn’t load your account'}
          subtitle={
            notInvited
              ? 'TruHost is invite only. Ask your TruHost contact to invite this email address, then sign in again.'
              : 'Something went wrong on our side. Try again in a moment.'
          }
        >
          {signedInAs && (
            <p className="text-center text-sm text-muted">
              Signed in as <strong className="text-ink">{signedInAs}</strong>
            </p>
          )}
          {!notInvited && <ErrorAlert error={me.error} />}
          <AuthButton type="button" onClick={handleSignOut}>
            Sign out
          </AuthButton>
        </AuthCard>
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
      // The owner page for properties they own, the cleaner page for ones they clean.
      const to = id ? propertyPath(user, id) : null;
      if (id && to) void navigate({ to, params: { propertyId: id } });
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
        avatarUrl: user.avatar?.url ?? null,
      }}
      properties={list.map((p) => ({ ...p, photoUrl: p.coverPhoto?.thumbUrl ?? null }))}
      selectedPropertyId={selectedId}
      onSelectProperty={selectProperty}
      allowAllProperties={isAdmin}
      onSignOut={handleSignOut}
    >
      <ScopeContext.Provider value={{ propertyId: selectedId, setPropertyId: setScope }}>
        <GuideContext.Provider value={guideFromApi(user.guide)}>
          <PreferencesContext.Provider value={{ weekStartsOn: user.weekStartsOn, motion: user.motion }}>
            <Outlet />
          </PreferencesContext.Provider>
        </GuideContext.Provider>
      </ScopeContext.Provider>
    </AppShell>
  );
}
