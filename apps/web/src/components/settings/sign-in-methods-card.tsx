import { useState, type FormEvent } from 'react';
import { isClerkAPIResponseError } from '@clerk/react/errors';
import { KeyRound } from 'lucide-react';
import { accountErrorMessage } from '../../lib/account-errors';
import { useSecureAction } from '../../lib/reverify';
import { useSecurityUser } from '../../lib/security-user';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Confirmation } from '../ui/confirmation';
import { Dialog } from '../ui/dialog';
import { Field } from '../ui/field';
import { PasswordInput } from '../ui/input';
import { Pill } from '../ui/pill';
import { SettingRow } from './setting-row';

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2-1.9 3.3-4.7 3.3-8z"
      />
      <path
        fill="#34A853"
        d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.9A11 11 0 0 0 12 23z"
      />
      <path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7H2.1a11 11 0 0 0 0 10l3.7-2.9z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7l3.7 2.9C6.7 7.3 9.1 5.4 12 5.4z" />
    </svg>
  );
}

/** How this person signs in: their password (change or add one) and Google, if linked. */
export function SignInMethodsCard() {
  const { user } = useSecurityUser();
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  if (!user) return null;
  const google = user.externalAccounts.find((a) => a.provider === 'google');
  const hasPassword = user.passwordEnabled;

  return (
    <Card title="Sign-in methods" description="The ways you can get into TruHost.">
      <div>
        <SettingRow
          icon={<KeyRound />}
          title="Password"
          status={hasPassword ? <Pill tone="sage">Set</Pill> : <Pill>Not set</Pill>}
          description={
            hasPassword
              ? 'Use a long password you don’t use anywhere else.'
              : 'You sign in with Google. Add a password to also sign in with your email.'
          }
        >
          {saved && <Confirmation>Password saved</Confirmation>}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setSaved(false);
              setOpen(true);
            }}
          >
            {hasPassword ? 'Change password' : 'Add a password'}
          </Button>
        </SettingRow>
        <SettingRow
          icon={<GoogleMark />}
          title="Google"
          status={google ? <Pill tone="sage">Connected</Pill> : <Pill>Not connected</Pill>}
          description={
            google
              ? `You can use “Continue with Google” as ${google.emailAddress}.`
              : 'If your email is a Google account, “Continue with Google” on the sign-in page links it.'
          }
        />
      </div>
      {open && (
        <PasswordDialog
          hasPassword={hasPassword}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            setSaved(true);
          }}
        />
      )}
    </Card>
  );
}

function PasswordDialog({
  hasPassword,
  onClose,
  onSaved,
}: {
  hasPassword: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useSecurityUser();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [signOutOthers, setSignOutOthers] = useState(true);
  const [errors, setErrors] = useState<{ current?: string; next?: string; confirm?: string; form?: string }>({});
  const [pending, setPending] = useState(false);
  const update = useSecureAction((params: Parameters<NonNullable<typeof user>['updatePassword']>[0]) =>
    user!.updatePassword(params),
  );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const problems: typeof errors = {};
    if (hasPassword && !current) problems.current = 'Enter your current password';
    if (next.length < 8) problems.next = 'Use at least 8 characters';
    else if (next !== confirm) problems.confirm = 'The two passwords don’t match';
    setErrors(problems);
    if (Object.keys(problems).length) return;
    setPending(true);
    try {
      await update({
        newPassword: next,
        ...(hasPassword ? { currentPassword: current } : {}),
        signOutOfOtherSessions: signOutOthers,
      });
      onSaved();
    } catch (err) {
      const wrongCurrent = isClerkAPIResponseError(err) && err.errors[0]?.code === 'form_password_incorrect';
      const message = accountErrorMessage(err);
      if (wrongCurrent) setErrors({ current: 'That isn’t your current password' });
      else if (message) setErrors({ form: message });
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && !pending && onClose()}
      size="sm"
      title={hasPassword ? 'Change password' : 'Add a password'}
      description="At least 8 characters. A short phrase is easier to remember and harder to guess."
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {hasPassword && (
          <Field label="Current password" error={errors.current}>
            <PasswordInput
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              autoFocus
            />
          </Field>
        )}
        <Field label="New password" error={errors.next}>
          <PasswordInput
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            autoFocus={!hasPassword}
          />
        </Field>
        <Field label="Confirm new password" error={errors.confirm}>
          <PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </Field>
        <label className="flex items-start gap-3 rounded-inner bg-ground p-3 text-sm">
          <input
            type="checkbox"
            checked={signOutOthers}
            onChange={(e) => setSignOutOthers(e.target.checked)}
            className="mt-0.5 size-4 accent-primary"
          />
          <span>
            <span className="block font-semibold text-ink">Sign out everywhere else</span>
            <span className="text-muted">Recommended if you think someone else knows your password.</span>
          </span>
        </label>
        {errors.form && (
          <p role="alert" className="text-sm text-danger-deep">
            {errors.form}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" loading={pending}>
            Save password
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
