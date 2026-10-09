import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useSession } from '@clerk/react';
import type { SessionVerificationResource } from '@clerk/react/types';
import { ShieldCheck } from 'lucide-react';
import { accountErrorMessage } from '../../lib/account-errors';
import type { ReverifyRequest } from '../../lib/reverify';
import { cleanCode } from '../../lib/security';
import { useSecurityUser } from '../../lib/security-user';
import { Button } from '../ui/button';
import { Dialog } from '../ui/dialog';
import { Field } from '../ui/field';
import { Input, PasswordInput } from '../ui/input';
import { Spinner } from '../ui/spinner';

type Stage = 'starting' | 'password' | 'email_code' | 'totp' | 'backup_code' | 'unsupported';

const COPY: Record<Exclude<Stage, 'starting' | 'unsupported'>, { label: string; hint: string }> = {
  password: { label: 'Your password', hint: 'The one you sign in to TruHost with.' },
  email_code: { label: 'Code from your email', hint: 'We just sent a 6-digit code to your email.' },
  totp: { label: 'Code from your authenticator app', hint: 'The 6-digit code for TruHost.' },
  backup_code: { label: 'Backup code', hint: 'One of the codes you saved when you set up two-step.' },
};

/**
 * "Confirm it’s you": Clerk asks for this before sensitive changes when the sign-in isn’t recent. Our own dialog
 * (no Clerk UI): password, or an emailed code for Google-only accounts, then the authenticator code if two-step is
 * on. When done, the original change is retried; closing cancels it.
 */
export function ReverifyDialog({ request, onClose }: { request: ReverifyRequest; onClose: () => void }) {
  const { session } = useSession();
  const { user } = useSecurityUser();
  const [stage, setStage] = useState<Stage>('starting');
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const started = useRef(false);

  const finish = (ok: boolean) => {
    if (ok) request.complete();
    else request.cancel();
    onClose();
  };

  /** Moves to whatever the verification needs next. */
  const advance = async (v: SessionVerificationResource) => {
    setValue('');
    if (v.status === 'complete') return finish(true);
    if (v.status === 'needs_second_factor') {
      const second = v.supportedSecondFactors ?? [];
      return setStage(
        second.some((f) => f.strategy === 'totp')
          ? 'totp'
          : second.some((f) => f.strategy === 'backup_code')
            ? 'backup_code'
            : 'unsupported',
      );
    }
    const first = v.supportedFirstFactors ?? [];
    if (first.some((f) => f.strategy === 'password')) return setStage('password');
    const email = first.find((f) => f.strategy === 'email_code');
    if (email && 'emailAddressId' in email) {
      await session!.prepareFirstFactorVerification({ strategy: 'email_code', emailAddressId: email.emailAddressId });
      return setStage('email_code');
    }
    setStage('unsupported');
  };

  useEffect(() => {
    if (started.current || !session) return;
    started.current = true;
    session
      .startVerification({ level: request.level ?? 'first_factor' })
      .then(advance)
      .catch((e: unknown) => {
        setError(accountErrorMessage(e));
        setStage('unsupported');
      });
    // Runs once per request (the dialog is keyed by it).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!session || stage === 'starting' || stage === 'unsupported' || !value.trim()) return;
    setPending(true);
    setError(null);
    try {
      const code = cleanCode(value);
      const v =
        stage === 'password'
          ? await session.attemptFirstFactorVerification({ strategy: 'password', password: value })
          : stage === 'email_code'
            ? await session.attemptFirstFactorVerification({ strategy: 'email_code', code })
            : await session.attemptSecondFactorVerification({ strategy: stage, code });
      await advance(v);
    } catch (err) {
      setError(accountErrorMessage(err));
    } finally {
      setPending(false);
    }
  };

  const copy = stage === 'starting' || stage === 'unsupported' ? null : COPY[stage];

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && !pending && finish(false)}
      size="sm"
      title={
        <span className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-full bg-sage-tint text-sage-deep">
            <ShieldCheck aria-hidden className="size-4" />
          </span>
          Confirm it’s you
        </span>
      }
      description="For your security, confirm your identity before making this change."
    >
      {stage === 'starting' && (
        <p className="flex items-center gap-2 text-sm text-muted" role="status">
          <Spinner /> One moment…
        </p>
      )}
      {stage === 'unsupported' && (
        <div className="flex flex-col gap-4">
          <p role="alert" className="text-sm text-danger-deep">
            {error ?? 'We can’t confirm your identity here. Sign out, sign in again, then make the change.'}
          </p>
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => finish(false)}>
              Close
            </Button>
          </div>
        </div>
      )}
      {copy && (
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <Field label={copy.label} hint={copy.hint} error={error ?? undefined}>
            {stage === 'password' ? (
              <PasswordInput
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoComplete="current-password"
                autoFocus
              />
            ) : (
              <Input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                inputMode={stage === 'backup_code' ? 'text' : 'numeric'}
                autoComplete="one-time-code"
                className="figure tracking-[0.2em]"
                maxLength={stage === 'backup_code' ? 20 : 9}
                autoFocus
              />
            )}
          </Field>
          {stage === 'totp' && user?.backupCodeEnabled && (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setValue('');
                setStage('backup_code');
              }}
              className="self-start text-sm font-semibold text-sage-deep hover:underline"
            >
              Use a backup code instead
            </button>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => finish(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" loading={pending} disabled={!value.trim()}>
              Confirm
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
