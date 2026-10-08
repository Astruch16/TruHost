import { createFileRoute, notFound } from '@tanstack/react-router';
import { AuthButton, AuthCard } from '../../components/auth/auth-card';
import { AuthFrame } from '../../components/shell/auth-frame';

/** Dev-only preview of the "no access" page (the real one needs a signed-in user with no invite). */
export const Route = createFileRoute('/dev/no-access')({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound();
  },
  component: () => (
    <AuthFrame>
      <AuthCard
        title="No access yet"
        subtitle="TruHost is invite only. Ask your TruHost contact to invite this email address, then sign in again."
      >
        <p className="text-center text-sm text-muted">
          Signed in as <strong className="text-ink">someone@example.com</strong>
        </p>
        <AuthButton type="button">Sign out</AuthButton>
      </AuthCard>
    </AuthFrame>
  ),
});
