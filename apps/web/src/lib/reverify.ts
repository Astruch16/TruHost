import { createContext, useContext } from 'react';
import { useReverification } from '@clerk/react';

/** What Clerk hands over when a sensitive change needs the user to confirm it's them first. */
export interface ReverifyRequest {
  level: 'first_factor' | 'second_factor' | 'multi_factor' | undefined;
  complete: () => void;
  cancel: () => void;
}

/** Opens our "Confirm it’s you" dialog (ReverifyDialog), which completes or cancels the request. */
export const ReverifyContext = createContext<(request: ReverifyRequest) => void>((request) => request.cancel());

/**
 * Wraps a Clerk call that may need a recent sign-in (changing the password, two-step verification, signing out
 * devices). If Clerk asks, our dialog confirms the user, then the call is retried. Cancelling rejects it.
 */
export function useSecureAction<A extends unknown[], R>(fetcher: (...args: A) => Promise<R>) {
  const ask = useContext(ReverifyContext);
  return useReverification(fetcher, { onNeedsReverification: ask });
}
