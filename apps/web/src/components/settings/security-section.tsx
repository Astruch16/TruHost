import { useState } from 'react';
import { DevicesCard } from './devices-card';
import { ReverifyDialog } from './reverify-dialog';
import { SignInMethodsCard } from './sign-in-methods-card';
import { TwoStepCard } from './two-step-card';
import { Skeleton } from '../ui/skeleton';
import { ReverifyContext, type ReverifyRequest } from '../../lib/reverify';
import { useSecurityUser } from '../../lib/security-user';

/** Password, two-step verification and devices, on Clerk's hooks with our own screens (no Clerk UI). */
export function SecuritySettings() {
  const { isLoaded } = useSecurityUser();
  const [request, setRequest] = useState<{ id: number; request: ReverifyRequest } | null>(null);
  if (!isLoaded) return <Skeleton className="h-72 rounded-card" />;
  return (
    <ReverifyContext.Provider value={(r) => setRequest({ id: Date.now(), request: r })}>
      <SignInMethodsCard />
      <TwoStepCard />
      <DevicesCard />
      {request && <ReverifyDialog key={request.id} request={request.request} onClose={() => setRequest(null)} />}
    </ReverifyContext.Provider>
  );
}
