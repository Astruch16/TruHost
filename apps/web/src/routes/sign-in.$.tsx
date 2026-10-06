import { createFileRoute } from '@tanstack/react-router';
import { SignIn } from '@clerk/react';
import { AuthFrame } from '../components/shell/auth-frame';
import { clerkAppearance } from '../lib/clerk-appearance';

export const Route = createFileRoute('/sign-in/$')({
  component: () => (
    <AuthFrame>
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        fallbackRedirectUrl="/"
        appearance={clerkAppearance}
      />
    </AuthFrame>
  ),
});
