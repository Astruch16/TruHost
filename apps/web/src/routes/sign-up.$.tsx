import { createFileRoute } from '@tanstack/react-router';
import { SignUp } from '@clerk/react';
import { AuthFrame } from '../components/shell/auth-frame';
import { clerkAppearance } from '../lib/clerk-appearance';

/**
 * Invite-only: Clerk is in Restricted mode, so only invitation links can complete sign-up. Nothing links here;
 * invited people arrive from the link in their invitation email.
 */
export const Route = createFileRoute('/sign-up/$')({
  component: () => (
    <AuthFrame>
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        fallbackRedirectUrl="/"
        appearance={clerkAppearance}
      />
    </AuthFrame>
  ),
});
