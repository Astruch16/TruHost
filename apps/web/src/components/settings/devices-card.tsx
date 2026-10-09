import { useState } from 'react';
import type { SessionWithActivitiesResource } from '@clerk/react/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Laptop, Smartphone } from 'lucide-react';
import { accountErrorMessage } from '../../lib/account-errors';
import { useSecureAction } from '../../lib/reverify';
import { deviceLabel, placeLabel, timeAgo } from '../../lib/security';
import { useSecurityUser } from '../../lib/security-user';
import { LoadError } from '../ui/alert';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Pill } from '../ui/pill';
import { Skeleton } from '../ui/skeleton';
import { SettingRow } from './setting-row';

const KEY = ['clerk', 'sessions'];

/** Where this person is signed in: this device first, the others with a Sign out button each (or all at once). */
export function DevicesCard() {
  const { user, sessionId } = useSecurityUser();
  const qc = useQueryClient();
  const sessions = useQuery({
    queryKey: KEY,
    queryFn: () => user!.getSessions(),
    enabled: Boolean(user),
    staleTime: 30_000,
  });
  const [pending, setPending] = useState<string | 'all' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const revoke = useSecureAction((targets: SessionWithActivitiesResource[]) =>
    Promise.all(targets.map((s) => s.revoke())),
  );

  const list = [...(sessions.data ?? [])]
    .filter((s) => s.status === 'active')
    .sort((a, b) => Number(b.id === sessionId) - Number(a.id === sessionId) || +b.lastActiveAt - +a.lastActiveAt);
  const others = list.filter((s) => s.id !== sessionId);

  const signOut = async (targets: SessionWithActivitiesResource[], key: string) => {
    setPending(key);
    setError(null);
    try {
      await revoke(targets);
      await qc.invalidateQueries({ queryKey: KEY });
    } catch (e) {
      setError(accountErrorMessage(e));
    } finally {
      setPending(null);
    }
  };

  return (
    <Card
      title="Signed-in devices"
      description="Don’t recognise one? Sign it out, then change your password."
      actions={
        others.length > 1 && (
          <Button variant="secondary" size="sm" loading={pending === 'all'} onClick={() => void signOut(others, 'all')}>
            Sign out all others
          </Button>
        )
      }
    >
      {sessions.error ? (
        <LoadError what="your devices" onRetry={() => void sessions.refetch()} retrying={sessions.isFetching} />
      ) : !sessions.data ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      ) : (
        <div>
          {list.map((s) => {
            const a = s.latestActivity;
            const current = s.id === sessionId;
            const Icon = a.isMobile ? Smartphone : Laptop;
            return (
              <SettingRow
                key={s.id}
                icon={<Icon />}
                title={deviceLabel(a)}
                status={current ? <Pill tone="sage">This device</Pill> : undefined}
                description={[placeLabel(a), current ? 'Active now' : timeAgo(s.lastActiveAt)]
                  .filter(Boolean)
                  .join(' · ')}
              >
                {!current && (
                  <Button
                    variant="quiet"
                    size="sm"
                    loading={pending === s.id}
                    disabled={pending === 'all'}
                    onClick={() => void signOut([s], s.id)}
                  >
                    Sign out
                  </Button>
                )}
              </SettingRow>
            );
          })}
          {others.length === 0 && <p className="mt-3 text-sm text-muted">You’re not signed in anywhere else.</p>}
          {error && (
            <p role="alert" className="mt-3 text-sm text-danger-deep">
              {error}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
