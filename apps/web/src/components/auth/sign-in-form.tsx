import { useState, type FormEvent } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuth, useSignIn } from '@clerk/react';
import { signInErrorMessage } from '../../lib/auth-errors';
import {
  AuthButton,
  AuthCard,
  AuthDivider,
  AuthError,
  AuthField,
  AuthLink,
  AuthNote,
  GoogleButton,
  PasswordField,
} from './auth-card';

type Step =
  | { kind: 'password' }
  | { kind: 'reset-request' }
  | { kind: 'reset-code' }
  | { kind: 'reset-password' }
  /** Clerk's device check: a new browser confirms with an emailed code before the session is created. */
  | { kind: 'device-code' };

/**
 * Our own sign-in on Clerk's useSignIn hook (no Clerk UI): email and password, Continue with Google, and the
 * forgot-password flow (email code, then a new password). Sign-up stays invite only, so there is no sign-up link;
 * invited users arrive through the link in their invitation.
 */
export function SignInForm({ initialError = null }: { initialError?: string | null }) {
  const { signIn } = useSignIn();
  const { isLoaded } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>({ kind: 'password' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(initialError);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<'submit' | 'google' | 'resend' | null>(null);
  /** Signed in and handing over to the portal: the button stays busy until the page changes. */
  const [leaving, setLeaving] = useState(false);

  const go = (next: Step) => {
    setError(null);
    setNotice(null);
    setCode('');
    setStep(next);
  };

  /** Runs one Clerk call; a returned error becomes a message for the user. Returns true on success. */
  const run = async (kind: 'submit' | 'google' | 'resend', call: () => Promise<{ error: unknown }>) => {
    setPending(kind);
    setError(null);
    try {
      const { error: e } = await call();
      if (e) {
        setError(signInErrorMessage(e));
        return false;
      }
      return true;
    } catch (e) {
      setError(signInErrorMessage(e));
      return false;
    } finally {
      setPending(null);
    }
  };

  /** After any successful step: open the session, or ask for the device check if Clerk needs it. */
  const continueSignIn = async () => {
    if (signIn.status === 'complete') {
      setLeaving(true);
      const opened = await run('submit', () =>
        signIn.finalize({
          navigate: ({ decorateUrl }) => {
            const url = decorateUrl('/');
            if (url.startsWith('http')) window.location.href = url;
            else void navigate({ to: url });
          },
        }),
      );
      if (!opened) setLeaving(false);
      return;
    }
    if (signIn.status === 'needs_client_trust' || signIn.status === 'needs_second_factor') {
      const byEmail = signIn.supportedSecondFactors.some((f) => f.strategy === 'email_code');
      if (!byEmail) {
        setError('This account needs a sign-in step we don’t support yet. Please contact TruHost.');
        return;
      }
      if (await run('submit', () => signIn.mfa.sendEmailCode())) go({ kind: 'device-code' });
      return;
    }
    if (signIn.status === 'needs_new_password') {
      go({ kind: 'reset-password' });
      return;
    }
    setError('Something went wrong signing in. Please try again.');
  };

  const submitPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Fill in both your email and password.');
      return;
    }
    if (await run('submit', () => signIn.password({ emailAddress: email.trim(), password }))) await continueSignIn();
  };

  const google = () =>
    run('google', () =>
      signIn.sso({
        strategy: 'oauth_google',
        redirectUrl: `${window.location.origin}/sso-callback`,
        redirectCallbackUrl: `${window.location.origin}/sso-callback`,
      }),
    );

  const sendResetCode = async () =>
    (await run('submit', () => signIn.create({ identifier: email.trim() }))) &&
    (await run('submit', () => signIn.resetPasswordEmailCode.sendCode()));

  const requestReset = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Enter the email you sign in with.');
      return;
    }
    if (await sendResetCode()) go({ kind: 'reset-code' });
  };

  const resendResetCode = async () => {
    setNotice(null);
    if ((await run('resend', () => signIn.resetPasswordEmailCode.sendCode())) === true) {
      setNotice(`We sent a new code to ${email.trim()}.`);
    }
  };

  const verifyResetCode = async (e: FormEvent) => {
    e.preventDefault();
    if (await run('submit', () => signIn.resetPasswordEmailCode.verifyCode({ code: code.trim() }))) {
      go({ kind: 'reset-password' });
    }
  };

  const saveNewPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setError('Use at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('The two passwords don’t match.');
      return;
    }
    const saved = await run('submit', () =>
      signIn.resetPasswordEmailCode.submitPassword({ password: newPassword, signOutOfOtherSessions: true }),
    );
    if (saved) await continueSignIn();
  };

  const verifyDeviceCode = async (e: FormEvent) => {
    e.preventDefault();
    if (await run('submit', () => signIn.mfa.verifyEmailCode({ code: code.trim() }))) await continueSignIn();
  };

  const resendDeviceCode = async () => {
    setNotice(null);
    if (await run('resend', () => signIn.mfa.sendEmailCode())) setNotice(`We sent a new code to ${email.trim()}.`);
  };

  const backToSignIn = () => {
    void signIn.reset();
    setPassword('');
    go({ kind: 'password' });
  };

  const notReady = !isLoaded;

  if (step.kind === 'reset-request') {
    return (
      <AuthCard title="Reset your password" subtitle="We’ll email you a code to choose a new one.">
        <form onSubmit={requestReset} noValidate className="flex flex-col gap-3.5 sm:gap-[18px]">
          <AuthField
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            invalid={Boolean(error)}
            autoFocus
          />
          <AuthError>{error}</AuthError>
          <AuthButton loading={pending === 'submit'} disabled={notReady}>
            Send code
          </AuthButton>
        </form>
        <div className="text-center">
          <AuthLink onClick={backToSignIn}>Back to sign in</AuthLink>
        </div>
      </AuthCard>
    );
  }

  if (step.kind === 'reset-code' || step.kind === 'device-code') {
    const reset = step.kind === 'reset-code';
    return (
      <AuthCard
        title="Check your email"
        subtitle={
          reset ? (
            <>
              Enter the code we sent to <strong className="text-ink">{email.trim()}</strong>.
            </>
          ) : (
            <>
              You’re signing in on a new device. Enter the code we sent to{' '}
              <strong className="text-ink">{email.trim()}</strong>.
            </>
          )
        }
      >
        <form
          onSubmit={reset ? verifyResetCode : verifyDeviceCode}
          noValidate
          className="flex flex-col gap-3.5 sm:gap-[18px]"
        >
          <AuthField
            label="Code"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="6-digit code"
            maxLength={10}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\s/g, ''))}
            invalid={Boolean(error)}
            autoFocus
          />
          <AuthError>{error}</AuthError>
          {notice && (
            <p role="status" className="text-center text-sm text-sage-deep">
              {notice}
            </p>
          )}
          <AuthButton loading={pending === 'submit' || leaving} disabled={!code.trim()}>
            {leaving ? 'Signing in…' : reset ? 'Continue' : 'Verify and sign in'}
          </AuthButton>
        </form>
        <div className="flex items-center justify-between">
          <AuthLink onClick={backToSignIn}>Back to sign in</AuthLink>
          <AuthLink onClick={() => void (reset ? resendResetCode() : resendDeviceCode())}>
            {pending === 'resend' ? 'Sending…' : 'Send a new code'}
          </AuthLink>
        </div>
      </AuthCard>
    );
  }

  if (step.kind === 'reset-password') {
    return (
      <AuthCard title="Choose a new password" subtitle="At least 8 characters. You’ll be signed in afterwards.">
        <form onSubmit={saveNewPassword} noValidate className="flex flex-col gap-3.5 sm:gap-[18px]">
          <PasswordField
            label="New password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            invalid={Boolean(error)}
            autoFocus
          />
          <PasswordField
            label="Confirm new password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            invalid={Boolean(error)}
          />
          <AuthError>{error}</AuthError>
          <AuthButton loading={pending === 'submit' || leaving}>
            {leaving ? 'Signing in…' : 'Save and sign in'}
          </AuthButton>
        </form>
        <div className="text-center">
          <AuthLink onClick={backToSignIn}>Back to sign in</AuthLink>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Welcome back" subtitle="Sign in to your TruHost portal">
      <GoogleButton
        onClick={() => void google()}
        loading={pending === 'google'}
        disabled={notReady || pending === 'submit'}
      />
      <AuthDivider>or with email</AuthDivider>
      <form onSubmit={submitPassword} noValidate className="flex flex-col gap-3.5 sm:gap-[18px]">
        <div className="flex flex-col gap-3.5">
          <AuthField
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            invalid={Boolean(error)}
          />
          <PasswordField
            label="Password"
            autoComplete="current-password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            invalid={Boolean(error)}
            aside={<AuthLink onClick={() => go({ kind: 'reset-request' })}>Forgot password?</AuthLink>}
          />
        </div>
        <AuthError>{error}</AuthError>
        <AuthButton loading={pending === 'submit' || leaving} disabled={notReady || pending === 'google'}>
          {leaving ? 'Signing in…' : 'Sign in'}
        </AuthButton>
      </form>
      <AuthNote>
        TruHost is invite only. If you own, clean or manage with us and need access, ask your TruHost contact.
      </AuthNote>
    </AuthCard>
  );
}
