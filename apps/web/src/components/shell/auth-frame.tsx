import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { phoneCardOffset } from '../../lib/login-scene';
import { clearFirstPaint } from '../../lib/use-load-stage';
import { useMediaQuery, useWindowSize } from '../../lib/use-viewport';
import { AuthTagline } from '../auth/auth-card';
import { LoginScene } from '../auth/login-scene';

/**
 * Full-page frame for sign-in and account-state pages (docs/design/Login.dc.html): the night scene behind
 * everything, the card centred, the tagline underneath. On phones the card is full width with 16px margins, sits
 * a little below the top so the moon shows above it, and the scene is framed around it (cabin and lake below);
 * the tagline is left out there, where it would cover the cabin. The page scrolls if a step is taller than the
 * screen; the scene stays put.
 */
export function AuthFrame({ children }: { children: ReactNode }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [card, setCard] = useState<{ top: number; bottom: number } | null>(null);
  const phone = useMediaQuery('(max-width: 640px)');
  const { height } = useWindowSize();
  // Phones: room above the card for the moon when the screen allows; short screens keep the form in view.
  const offset = phone && card ? phoneCardOffset(height, card.bottom - card.top) : undefined;

  // Sign-in and account pages replace the first-paint screen from index.html.
  useLayoutEffect(clearFirstPaint, []);

  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const next = { top: Math.round(r.top + window.scrollY), bottom: Math.round(r.bottom + window.scrollY) };
      setCard((prev) => (prev && prev.top === next.top && prev.bottom === next.bottom ? prev : next));
    };
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
    <div className="relative min-h-dvh bg-[#0B1A24]">
      <div className="fixed inset-0 overflow-hidden">
        <LoginScene card={card} />
      </div>
      <main
        className="relative z-10 flex min-h-dvh flex-col items-center justify-start gap-[22px] px-4 pt-16 pb-8 sm:justify-center sm:p-6"
        style={offset === undefined ? undefined : { paddingTop: offset }}
      >
        <div ref={cardRef} className="flex w-full justify-center">
          {children}
        </div>
        <AuthTagline />
      </main>
    </div>
  );
}
