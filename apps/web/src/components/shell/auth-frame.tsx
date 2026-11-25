import { useLayoutEffect, type ReactNode } from 'react';
import { clearFirstPaint } from '../../lib/use-load-stage';
import { AuthBrand } from '../auth/auth-card';

/**
 * Full-page frame for sign-in and account-state pages: a plain white page with one narrow column in the middle, the
 * TruHost logo centred at its top and the page's content under it. The page scrolls if a step is taller than the
 * screen.
 */
export function AuthFrame({ children }: { children: ReactNode }) {
  // Sign-in and account pages replace the first-paint screen from index.html.
  useLayoutEffect(clearFirstPaint, []);

  return (
    <div data-auth-frame className="flex min-h-dvh flex-col bg-white">
      <main className="flex flex-1 flex-col items-center justify-start gap-7 px-4 pt-12 pb-10 sm:justify-center sm:px-6 sm:py-16">
        <AuthBrand />
        <div className="flex w-full justify-center">{children}</div>
      </main>
    </div>
  );
}
