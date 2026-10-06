import { createFileRoute } from '@tanstack/react-router';
import { SignUp } from '@clerk/react';

/** Invite-only: Clerk is in Restricted mode, so only invitation links can complete sign-up. */
export const Route = createFileRoute('/sign-up/$')({
  component: () => (
    <main className="flex flex-1 items-center justify-center p-4">
      <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" fallbackRedirectUrl="/" />
    </main>
  ),
});
