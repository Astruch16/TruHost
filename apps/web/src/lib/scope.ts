import { createContext, useContext } from 'react';

/**
 * The property the admin pages are narrowed to (null = all properties), chosen in the top-bar switcher. Kept per
 * browser for convenience; storage may be unavailable.
 */
export interface Scope {
  propertyId: string | null;
  setPropertyId: (id: string | null) => void;
}

export const ScopeContext = createContext<Scope>({ propertyId: null, setPropertyId: () => undefined });
export const useScope = () => useContext(ScopeContext);

const KEY = 'truhost:scope';

export function readStoredScope(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function storeScope(id: string | null): void {
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch {
    // Private mode or blocked storage: the choice still applies for this page view.
  }
}

/** `?month=YYYY-MM` search param, validated. */
export function monthSearch(search: Record<string, unknown>): { month?: string } {
  return typeof search.month === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(search.month)
    ? { month: search.month }
    : {};
}
