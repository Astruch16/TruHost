import { createFileRoute } from '@tanstack/react-router';
import { SignIn } from '@clerk/react';

export const Route = createFileRoute('/sign-in/$')({
  component: () => (
    <main className="flex flex-1 items-center justify-center p-4">
      <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" fallbackRedirectUrl="/" />
    </main>
  ),
});
