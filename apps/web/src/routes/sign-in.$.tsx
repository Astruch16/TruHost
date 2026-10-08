import { createFileRoute, Navigate } from '@tanstack/react-router';
import { useAuth } from '@clerk/react';
import { SignInForm } from '../components/auth/sign-in-form';
import { AuthFrame } from '../components/shell/auth-frame';

const ERRORS = {
  /** Back from Google with an address that has no TruHost account (sign-up is invite only). */
  'no-account':
    'There’s no TruHost account for that Google address. TruHost is invite only: use the link in your invitation email, or ask your TruHost contact.',
  google: 'Google sign-in didn’t finish. Please try again.',
} as const;

export const Route = createFileRoute('/sign-in/$')({
  validateSearch: (s: Record<string, unknown>): { error?: keyof typeof ERRORS } =>
    typeof s.error === 'string' && s.error in ERRORS ? { error: s.error as keyof typeof ERRORS } : {},
  component: SignInPage,
});

function SignInPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const { error } = Route.useSearch();
  if (isLoaded && isSignedIn) return <Navigate to="/" />;
  return (
    <AuthFrame>
      <SignInForm initialError={error ? ERRORS[error] : null} />
    </AuthFrame>
  );
}
