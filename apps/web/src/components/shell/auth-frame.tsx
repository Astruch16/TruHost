import { useLayoutEffect, type ReactNode } from 'react';
import { clearFirstPaint } from '../../lib/use-load-stage';
import { AuthBrand, AuthTagline } from '../auth/auth-card';

/**
 * Full-page frame for sign-in and account-state pages: a plain white page with the TruHost logo in the top-left
 * corner, the card centred and the tagline underneath (wider screens only). On phones the logo sits above the card.
 * The page scrolls if a step is taller than the screen.
 */
export function AuthFrame({ children }: { children: ReactNode }) {
  // Sign-in and account pages replace the first-paint screen from index.html.
  useLayoutEffect(clearFirstPaint, []);

  return (
    <div data-auth-frame className="flex min-h-dvh flex-col bg-white">
      <header className="px-4 pt-4 sm:absolute sm:top-6 sm:left-8 sm:p-0">
        <AuthBrand />
      </header>
      <main className="flex flex-1 flex-col items-center justify-start gap-[22px] px-4 pt-6 pb-8 sm:justify-center sm:px-6 sm:py-24">
        <div className="flex w-full justify-center">{children}</div>
        <AuthTagline />
      </main>
    </div>
  );
}
