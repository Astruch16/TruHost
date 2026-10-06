import { createFileRoute } from '@tanstack/react-router';
import { SignUp } from '@clerk/react';
import { AuthFrame } from '../components/shell/auth-frame';
import { clerkAppearance } from '../lib/clerk-appearance';

/** Invite-only: Clerk is in Restricted mode, so only invitation links can complete sign-up. */
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
