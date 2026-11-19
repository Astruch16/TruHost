import { useContext } from 'react';
import { QueryClientContext, type QueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import type { ApiClient } from '@truhost/api-client';
import type { Me } from '@truhost/shared';
import { ApiContext } from './api-context';
import { monthKey } from './months';
import { usesOwnerPortal } from './nav';
import { queries } from './queries';
import { readStoredScope } from './scope';

/** Where someone lands after signing in, by their role. `/` shows "no properties yet" to someone with none. */
export type Landing = '/admin' | '/owner' | '/cleaner' | '/properties' | '/';

export function landingPath(me: Pick<Me, 'staffRole' | 'memberships'>): Landing {
  if (me.staffRole === 'ADMIN') return '/admin';
  if (usesOwnerPortal(me)) return '/owner';
  if (me.memberships.some((m) => m.role === 'CLEANER')) return '/cleaner';
  if (me.memberships.length > 0) return '/properties';
  return '/';
}

/**
 * Longest the sign-in button waits for the portal to be ready before opening it anyway (the portal's own loading
 * screen takes over from there). Usually it's ready well before.
 */
export const ENTRY_WAIT_MS = 2500;

/**
 * Gets the portal ready while the sign-in button still says "Signing in": the account (which decides the page), that
 * page's code, the property list the top bar needs, and the page's main figures. Resolves to the page to open; rejects
 * if the account can't be loaded (the portal then shows why).
 */
export async function warmPortal(qc: QueryClient, api: ApiClient, preload: (to: Landing) => Promise<unknown>) {
  const me = await qc.fetchQuery(queries.me(api));
  const to = landingPath(me);
  const scope = readStoredScope();
  const work: Promise<unknown>[] = [preload(to).catch(() => undefined)];
  if (to === '/admin') {
    work.push(qc.prefetchQuery(queries.properties(api)), qc.prefetchQuery(queries.dashboard(api, monthKey(), scope)));
  } else if (to === '/owner') {
    work.push(
      qc.fetchQuery(queries.ownerProperties(api)).then((owned) => {
        // As the shell picks it: the remembered property, the only one, or all of them.
        const known = owned.items.some((p) => p.id === scope);
        const selected = known ? scope : owned.items.length === 1 ? owned.items[0]!.id : null;
        return qc.prefetchQuery(queries.ownerHome(api, selected));
      }),
    );
  } else if (to !== '/') {
    work.push(qc.prefetchQuery(queries.properties(api)));
  }
  await Promise.all(work.map((w) => w.catch(() => undefined)));
  return to;
}

/**
 * For the sign-in page and Google's return: opens the portal once it's ready (or after ENTRY_WAIT_MS, whichever comes
 * first) on the person's own page, cross-fading from the sign-in screen (styles.css, view transition type
 * "enter-portal") rather than cutting to a loading screen and then redirecting.
 */
export function useEnterPortal(): (options?: { replace?: boolean }) => Promise<void> {
  const qc = useContext(QueryClientContext);
  const api = useContext(ApiContext);
  const router = useRouter();
  return async ({ replace = false } = {}) => {
    let to: Landing = '/';
    if (qc && api) {
      const ready = warmPortal(qc, api, (path) => router.preloadRoute({ to: path })).catch(() => '/' as const);
      const timeout = new Promise<'/'>((resolve) => setTimeout(() => resolve('/'), ENTRY_WAIT_MS));
      to = await Promise.race([ready, timeout]);
    }
    await router.navigate({ to, replace, viewTransition: { types: ['enter-portal'] } });
  };
}
