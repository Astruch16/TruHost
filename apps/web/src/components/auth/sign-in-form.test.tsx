import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClerkAPIResponseError } from '@clerk/react/errors';
import { SignInForm } from './sign-in-form';

const navigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }));

const ok = { error: null };
const fail = (code: string, status = 422, retryAfter?: number) => ({
  error: new ClerkAPIResponseError('internal', { data: [{ code, message: 'Clerk says no' }], status, retryAfter }),
});

/** A stand-in for Clerk's SignInFuture: each method resolves as the test arranges. */
const signIn = {
  status: 'needs_first_factor' as string,
  supportedSecondFactors: [] as { strategy: string }[],
  password: vi.fn(),
  create: vi.fn(),
  sso: vi.fn(),
  finalize: vi.fn(),
  reset: vi.fn(),
  resetPasswordEmailCode: { sendCode: vi.fn(), verifyCode: vi.fn(), submitPassword: vi.fn() },
  mfa: { sendEmailCode: vi.fn(), verifyEmailCode: vi.fn() },
};
vi.mock('@clerk/react', () => ({
  useSignIn: () => ({ signIn, errors: {}, fetchStatus: 'idle' }),
  useAuth: () => ({ isLoaded: true }),
}));

const user = userEvent.setup();
const signInWith = async (email: string, password: string) => {
  await user.type(screen.getByLabelText('Email'), email);
  await user.type(screen.getByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
};

beforeEach(() => {
  vi.clearAllMocks();
  signIn.status = 'needs_first_factor';
  signIn.supportedSecondFactors = [];
  for (const fn of [
    signIn.password,
    signIn.create,
    signIn.sso,
    signIn.reset,
    signIn.resetPasswordEmailCode.sendCode,
    signIn.resetPasswordEmailCode.verifyCode,
    signIn.mfa.sendEmailCode,
  ]) {
    fn.mockResolvedValue(ok);
  }
  signIn.finalize.mockImplementation(async ({ navigate: nav }) => {
    nav({ decorateUrl: (u: string) => u, session: {} });
    return ok;
  });
});

describe('SignInForm', () => {
  it('matches the board: Google, email and password, forgot password, invite-only note, no sign-up link', () => {
    render(<SignInForm />);
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Forgot password?' })).toBeInTheDocument();
    expect(screen.getByText(/TruHost is invite only/)).toBeInTheDocument();
    expect(screen.queryByText(/sign up/i)).toBeNull();
    expect(screen.queryByText(/clerk/i)).toBeNull();
  });

  it('signs in with email and password and opens the app', async () => {
    signIn.password.mockImplementation(async () => {
      signIn.status = 'complete';
      return ok;
    });
    render(<SignInForm />);
    await signInWith('owner@example.com', 'correct horse');
    expect(signIn.password).toHaveBeenCalledWith({ emailAddress: 'owner@example.com', password: 'correct horse' });
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: '/' }));
  });

  it('stays busy after signing in, until the portal takes over', async () => {
    signIn.password.mockImplementation(async () => {
      signIn.status = 'complete';
      return ok;
    });
    signIn.finalize.mockResolvedValue(ok); // navigation pending: the page hasn't changed yet
    render(<SignInForm />);
    await signInWith('owner@example.com', 'correct horse');
    const button = await screen.findByRole('button', { name: 'Signing in…' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it.each([
    ['form_password_incorrect', 422, undefined, /password isn’t right/],
    ['form_identifier_not_found', 422, undefined, /no TruHost account for that email/],
    ['too_many_requests', 429, undefined, /Too many attempts. Wait a minute/],
    ['user_locked', 403, 600, /locked for 10 minutes/],
  ])('explains %s clearly', async (code, status, retryAfter, message) => {
    signIn.password.mockResolvedValue(fail(code, status, retryAfter));
    render(<SignInForm />);
    await signInWith('owner@example.com', 'nope');
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByRole('alert')).not.toHaveTextContent(/clerk/i);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('asks for both fields before calling Clerk', async () => {
    render(<SignInForm />);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Fill in both your email and password.');
    expect(signIn.password).not.toHaveBeenCalled();
  });

  it('confirms a new device with an emailed code', async () => {
    signIn.password.mockImplementation(async () => {
      signIn.status = 'needs_client_trust';
      signIn.supportedSecondFactors = [{ strategy: 'email_code' }];
      return ok;
    });
    signIn.mfa.verifyEmailCode.mockImplementation(async () => {
      signIn.status = 'complete';
      return ok;
    });
    render(<SignInForm />);
    await signInWith('owner@example.com', 'correct horse');
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
    expect(signIn.mfa.sendEmailCode).toHaveBeenCalled();
    await user.type(screen.getByLabelText('Code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Verify and sign in' }));
    expect(signIn.mfa.verifyEmailCode).toHaveBeenCalledWith({ code: '123456' });
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: '/' }));
  });

  it('resets a forgotten password: email, code, new password, then signs in', async () => {
    signIn.resetPasswordEmailCode.verifyCode.mockImplementation(async () => {
      signIn.status = 'needs_new_password';
      return ok;
    });
    signIn.resetPasswordEmailCode.submitPassword.mockImplementation(async () => {
      signIn.status = 'complete';
      return ok;
    });
    render(<SignInForm />);
    await user.type(screen.getByLabelText('Email'), 'owner@example.com');
    await user.click(screen.getByRole('button', { name: 'Forgot password?' }));

    expect(screen.getByRole('heading', { name: 'Reset your password' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveValue('owner@example.com');
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    expect(signIn.create).toHaveBeenCalledWith({ identifier: 'owner@example.com' });
    expect(signIn.resetPasswordEmailCode.sendCode).toHaveBeenCalled();

    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Code'), '654321');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(signIn.resetPasswordEmailCode.verifyCode).toHaveBeenCalledWith({ code: '654321' });

    expect(await screen.findByRole('heading', { name: 'Choose a new password' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('New password'), 'a-new-password');
    await user.type(screen.getByLabelText('Confirm new password'), 'a-different-one');
    await user.click(screen.getByRole('button', { name: 'Save and sign in' }));
    expect(screen.getByRole('alert')).toHaveTextContent('The two passwords don’t match.');

    await user.clear(screen.getByLabelText('Confirm new password'));
    await user.type(screen.getByLabelText('Confirm new password'), 'a-new-password');
    await user.click(screen.getByRole('button', { name: 'Save and sign in' }));
    expect(signIn.resetPasswordEmailCode.submitPassword).toHaveBeenCalledWith({
      password: 'a-new-password',
      signOutOfOtherSessions: true,
    });
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: '/' }));
  });

  it('shows a wrong reset code and lets the user ask for a new one', async () => {
    signIn.resetPasswordEmailCode.verifyCode.mockResolvedValue(fail('form_code_incorrect'));
    render(<SignInForm />);
    await user.click(screen.getByRole('button', { name: 'Forgot password?' }));
    await user.type(screen.getByLabelText('Email'), 'owner@example.com');
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    await user.type(await screen.findByLabelText('Code'), '000000');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/code isn’t right/);
    await user.click(screen.getByRole('button', { name: 'Send a new code' }));
    expect(await screen.findByRole('status')).toHaveTextContent('We sent a new code to owner@example.com.');
  });

  it('sends Google sign-in through the callback page', async () => {
    render(<SignInForm />);
    await user.click(screen.getByRole('button', { name: 'Continue with Google' }));
    expect(signIn.sso).toHaveBeenCalledWith({
      strategy: 'oauth_google',
      redirectUrl: `${window.location.origin}/sso-callback`,
      redirectCallbackUrl: `${window.location.origin}/sso-callback`,
    });
  });

  it('shows a message passed in from the Google callback', () => {
    render(<SignInForm initialError="There’s no TruHost account for that Google address." />);
    expect(screen.getByRole('alert')).toHaveTextContent('no TruHost account for that Google address');
  });
});
