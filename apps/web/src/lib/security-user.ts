import { createContext, useContext } from 'react';
import { useSession, useUser } from '@clerk/react';
import type { UserResource } from '@clerk/react/types';

/** The parts of Clerk's user that Settings → Security uses. */
export type SecurityUser = Pick<
  UserResource,
  | 'passwordEnabled'
  | 'externalAccounts'
  | 'totpEnabled'
  | 'backupCodeEnabled'
  | 'primaryEmailAddress'
  | 'updatePassword'
  | 'createTOTP'
  | 'verifyTOTP'
  | 'disableTOTP'
  | 'createBackupCode'
  | 'getSessions'
  | 'reload'
>;

/** A stand-in user for the dev preview (/dev/settings). Null in the app, where Clerk's signed-in user is used. */
export const SecurityUserContext = createContext<{ user: SecurityUser; sessionId: string } | null>(null);

/** The signed-in user and this device's session id, from Clerk (or the preview's stand-in). */
export function useSecurityUser(): { user: SecurityUser | null; sessionId: string | null; isLoaded: boolean } {
  const preview = useContext(SecurityUserContext);
  const { user, isLoaded } = useUser();
  const { session } = useSession();
  if (preview) return { ...preview, isLoaded: true };
  return { user: user ?? null, sessionId: session?.id ?? null, isLoaded };
}
