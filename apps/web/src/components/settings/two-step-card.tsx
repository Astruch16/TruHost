import { useEffect, useState, type FormEvent } from 'react';
import { Check, Copy, Download, KeySquare, Smartphone } from 'lucide-react';
import { accountErrorMessage } from '../../lib/account-errors';
import { useSecureAction } from '../../lib/reverify';
import { useSecurityUser } from '../../lib/security-user';
import { backupCodesFile, cleanCode, formatSecret } from '../../lib/security';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { ConfirmDialog, Dialog } from '../ui/dialog';
import { Field } from '../ui/field';
import { Input } from '../ui/input';
import { Pill } from '../ui/pill';
import { Spinner } from '../ui/spinner';
import { SettingRow } from './setting-row';

/**
 * Two-step verification with an authenticator app (Google Authenticator, 1Password, Authy…): set up with a QR code,
 * backup codes for a lost phone, turn off. All through Clerk; nothing is stored by TruHost.
 */
export function TwoStepCard() {
  const { user } = useSecurityUser();
  const [dialog, setDialog] = useState<'setup' | 'disable' | 'codes' | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const disable = useSecureAction(() => user!.disableTOTP());
  const newCodes = useSecureAction(() => user!.createBackupCode());
  if (!user) return null;
  const on = user.totpEnabled;

  const turnOff = async () => {
    setPending(true);
    setError(null);
    try {
      await disable();
      await user?.reload();
      setDialog(null);
    } catch (e) {
      setError(accountErrorMessage(e));
    } finally {
      setPending(false);
    }
  };

  const makeCodes = async () => {
    setPending(true);
    setError(null);
    try {
      const made = await newCodes();
      await user?.reload();
      setCodes(made.codes);
      setDialog('codes');
    } catch (e) {
      setError(accountErrorMessage(e));
    } finally {
      setPending(false);
    }
  };

  return (
    <Card
      title="Two-step verification"
      description="After your password, TruHost also asks for a code from your phone, so a stolen password isn’t enough."
    >
      <div>
        <SettingRow
          icon={<Smartphone />}
          title="Authenticator app"
          status={on ? <Pill tone="sage">On</Pill> : <Pill>Off</Pill>}
          description={
            on
              ? 'You’ll enter a 6-digit code from your app when you sign in on a new device.'
              : 'Use an app like Google Authenticator, Microsoft Authenticator or 1Password.'
          }
        >
          {on ? (
            <Button variant="danger" size="sm" onClick={() => setDialog('disable')}>
              Turn off
            </Button>
          ) : (
            <Button size="sm" onClick={() => setDialog('setup')}>
              Set up
            </Button>
          )}
        </SettingRow>
        {on && (
          <SettingRow
            icon={<KeySquare />}
            title="Backup codes"
            status={user.backupCodeEnabled ? <Pill tone="sage">Ready</Pill> : undefined}
            description="One-time codes for when you don’t have your phone. Making new ones stops the old ones working."
          >
            <Button variant="secondary" size="sm" onClick={() => void makeCodes()} loading={pending && !dialog}>
              Make new codes
            </Button>
          </SettingRow>
        )}
        {error && !dialog && (
          <p role="alert" className="mt-3 text-sm text-danger-deep">
            {error}
          </p>
        )}
      </div>

      {dialog === 'setup' && (
        <SetupDialog
          onClose={() => setDialog(null)}
          onDone={(backup) => {
            if (backup?.length) {
              setCodes(backup);
              setDialog('codes');
            } else setDialog(null);
          }}
        />
      )}
      <ConfirmDialog
        open={dialog === 'disable'}
        onOpenChange={(o) => {
          if (!o) setDialog(null);
          setError(null);
        }}
        title="Turn off two-step verification?"
        description="You’ll sign in with your password alone. Your backup codes stop working too."
        confirmLabel="Turn off"
        destructive
        pending={pending}
        error={error ? new Error(error) : null}
        onConfirm={() => void turnOff()}
      />
      {dialog === 'codes' && codes && (
        <BackupCodesDialog
          codes={codes}
          email={user.primaryEmailAddress?.emailAddress ?? ''}
          onClose={() => setDialog(null)}
        />
      )}
    </Card>
  );
}

function SetupDialog({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: (backupCodes: string[] | undefined) => void;
}) {
  const { user } = useSecurityUser();
  const [totp, setTotp] = useState<{ secret: string; uri: string } | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const create = useSecureAction(() => user!.createTOTP());

  useEffect(() => {
    let cancelled = false;
    create()
      .then(async (t) => {
        if (cancelled || !t.secret || !t.uri) return;
        setTotp({ secret: t.secret, uri: t.uri });
        // Loaded on demand: only needed while setting up.
        const { toDataURL } = await import('qrcode');
        const url = await toDataURL(t.uri, {
          margin: 1,
          width: 400,
          color: { dark: '#1a1d21', light: '#ffffff' },
        });
        if (!cancelled) setQr(url);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const message = accountErrorMessage(e);
        if (message) setError(message);
        else onClose();
      });
    return () => {
      cancelled = true;
    };
    // Once per opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    if (cleanCode(code).length < 6) {
      setError('Enter the 6-digit code from your app.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      const done = await user!.verifyTOTP({ code: cleanCode(code) });
      await user!.reload();
      onDone(done.backupCodes);
    } catch (err) {
      setError(accountErrorMessage(err));
    } finally {
      setPending(false);
    }
  };

  const copySecret = async () => {
    if (!totp) return;
    await navigator.clipboard?.writeText(totp.secret);
    setCopied(true);
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && !pending && onClose()}
      size="md"
      title="Set up your authenticator app"
      description="Two quick steps. Keep this window open until you’re done."
    >
      <form onSubmit={verify} noValidate className="flex flex-col gap-5">
        <ol className="flex flex-col gap-5">
          <li className="flex flex-col gap-3">
            <p className="text-sm text-ink">
              <StepNumber n={1} /> Open your authenticator app, add an account and scan this code.
            </p>
            <div className="flex flex-col items-center gap-4 rounded-inner bg-ground p-4 sm:flex-row sm:items-start">
              <div className="grid size-40 shrink-0 place-items-center overflow-hidden rounded-xl bg-white p-2 shadow-sm">
                {qr ? (
                  <img src={qr} alt="QR code to add TruHost to your authenticator app" className="size-full" />
                ) : error && !totp ? null : (
                  <Spinner />
                )}
              </div>
              <div className="flex min-w-0 flex-col gap-2 text-sm">
                <p className="text-muted">Can’t scan it? Enter this key in the app instead:</p>
                {totp ? (
                  <code className="figure rounded-lg border border-line bg-surface px-3 py-2 text-[0.8rem] font-semibold tracking-wider text-ink">
                    {formatSecret(totp.secret)
                      .split(' ')
                      .map((group, i) => (
                        <span key={i} className="mr-2 inline-block last:mr-0">
                          {group}
                        </span>
                      ))}
                  </code>
                ) : (
                  <span className="h-9 animate-skeleton rounded-lg bg-line-soft" />
                )}
                <Button
                  variant="quiet"
                  size="sm"
                  className="self-start"
                  onClick={() => void copySecret()}
                  disabled={!totp}
                >
                  {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
                  {copied ? 'Copied' : 'Copy key'}
                </Button>
              </div>
            </div>
          </li>
          <li className="flex flex-col gap-3">
            <p className="text-sm text-ink">
              <StepNumber n={2} /> Enter the 6-digit code the app shows for TruHost.
            </p>
            <Field label="Code" error={error ?? undefined}>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123 456"
                maxLength={9}
                className="figure max-w-48 text-lg tracking-[0.3em]"
                disabled={!totp}
              />
            </Field>
          </li>
        </ol>
        <div className="flex justify-end gap-2 border-t border-line-soft pt-4">
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" loading={pending} disabled={!totp}>
            Turn on
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function StepNumber({ n }: { n: number }) {
  return (
    <span className="mr-1.5 inline-grid size-6 place-items-center rounded-full bg-primary text-xs font-bold text-white">
      {n}
    </span>
  );
}

/** Shown once, straight after the codes are made: copy or download them, then confirm they're saved. */
function BackupCodesDialog({ codes, email, onClose }: { codes: string[]; email: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const text = backupCodesFile(codes, email);
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'truhost-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      size="md"
      title="Save your backup codes"
      description="If you lose your phone, each code gets you in once. This is the only time we’ll show them."
      footer={<Button onClick={onClose}>I’ve saved them</Button>}
    >
      <ul
        aria-label="Backup codes"
        className="grid grid-cols-2 gap-2 rounded-inner border border-dashed border-line bg-ground p-4 sm:grid-cols-3"
      >
        {codes.map((c) => (
          <li
            key={c}
            className="figure rounded-lg bg-surface px-3 py-2 text-center text-sm font-semibold tracking-wider text-ink"
          >
            {c}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void navigator.clipboard?.writeText(codes.join('\n')).then(() => setCopied(true))}
        >
          {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
          {copied ? 'Copied' : 'Copy all'}
        </Button>
        <Button variant="secondary" size="sm" onClick={download}>
          <Download aria-hidden className="size-4" /> Download
        </Button>
      </div>
    </Dialog>
  );
}
