import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { portraitFraming } from '../../lib/login-backdrop';
import { clearFirstPaint } from '../../lib/use-load-stage';
import { useMediaQuery, useWindowSize } from '../../lib/use-viewport';
import { AuthTagline } from '../auth/auth-card';
import { LoginBackdrop } from '../auth/login-backdrop';

/**
 * Full-page frame for sign-in and account-state pages: the campfire loop behind everything (LoginBackdrop), the
 * card centred, the tagline underneath (wider screens only). On portrait screens the card sits near the top and the
 * loop is framed below it, so the guides by the fire show under the card rather than behind it. The page scrolls if
 * a step is taller than the screen; the background stays put.
 */
export function AuthFrame({ children }: { children: ReactNode }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [bottom, setBottom] = useState<number | null>(null);
  const portrait = useMediaQuery('(orientation: portrait)');
  const screen = useWindowSize();
  const framing = portrait && bottom !== null ? portraitFraming(screen, bottom) : undefined;

  // Sign-in and account pages replace the first-paint screen from index.html.
  useLayoutEffect(clearFirstPaint, []);

  // Where the card (and tagline) end, from the top of the page; steps change height, so keep watching.
  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const measure = () => setBottom(Math.round(el.getBoundingClientRect().bottom + window.scrollY));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  return (
    <div data-auth-frame className="relative min-h-dvh bg-[#465996]">
      <LoginBackdrop framing={framing} />
      <main className="relative z-10 flex min-h-dvh flex-col items-center justify-start px-4 pt-16 pb-8 sm:px-6 sm:landscape:justify-center sm:landscape:py-6">
        <div ref={contentRef} className="flex w-full flex-col items-center gap-[22px]">
          <div className="flex w-full justify-center">{children}</div>
          <AuthTagline />
        </div>
      </main>
    </div>
  );
}
