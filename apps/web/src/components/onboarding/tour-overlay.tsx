import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from '@tanstack/react-router';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { cx } from '../../lib/cx';
import { GUIDES, type GuideCharacter } from '../../lib/guides';
import { placeCard, scrollTarget, type Box } from '../../lib/tour-position';
import type { TourPage, TourStep } from '../../lib/tours';
import { useMediaQuery } from '../../lib/use-viewport';
import { Guide } from '../guide/guide';
import { Button } from '../ui/button';

/** Room around the highlighted element, and how long a step waits for its element to appear after navigating. */
const PAD = 8;
const FIND_MS = 4000;
/** How long an optional step looks for its card: on the page already shown, and on a page just opened. */
const OPTIONAL_MS = 150;
const OPTIONAL_AFTER_LOAD_MS = 800;
/** After opening a page, how long to let it render before looking (the old page can linger for a frame or two). */
const SETTLE_MS = 120;
/** How long the highlight, the card and the page take to move to the next step, and the tour to fade out. */
const MOVE_MS = 420;
const MAX_MOVE_MS = 800;
const FADE_MS = 180;

type Step = TourStep & { target: TourPage | null };
type Point = { top: number; left: number };
/** What's on screen in one frame: the highlighted box (the hole in the dimming), the card's place, the ring. */
type Frame = { hole: Box; card: Point | null; ring: boolean };

const visible = (el: Element) => el.getClientRects().length > 0;
/** The step's element, if one is on screen. */
const findAnchor = (anchor: string | undefined): Element | null =>
  (anchor && [...document.querySelectorAll(`[data-tour="${anchor}"]`)].find(visible)) || null;
const toBox = (r: DOMRect): Box => ({ top: r.top, left: r.left, width: r.width, height: r.height });
const viewport = () => ({ width: window.innerWidth, height: window.innerHeight });
/** Nothing to point at: the hole shrinks to the middle of the screen, so the whole page is dimmed. */
const centre = (v = viewport()): Box => ({ top: v.height / 2, left: v.width / 2, width: 0, height: 0 });
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const mixBox = (a: Box, b: Box, t: number): Box => ({
  top: mix(a.top, b.top, t),
  left: mix(a.left, b.left, t),
  width: mix(a.width, b.width, t),
  height: mix(a.height, b.height, t),
});
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const reducedMotion = () =>
  document.documentElement.dataset.motion === 'reduced' ||
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * One step of a welcome tour: the page dims around the element the step is about, and the guide (pointing) explains
 * it in a card beside it, or in a bottom sheet on phones. The step's page is opened first if the user is elsewhere.
 * A step whose element isn't there shows centred, or is passed over when it's optional.
 *
 * Moving between steps is one continuous motion: the dimming stays, the card keeps the last step until the next one is
 * found, then the page scrolls while the highlight glides from the old element to the new one and the card moves with
 * it, its words cross-fading. The tour fades in and out. Under reduced motion every move is instant.
 *
 * Keyboard: focus moves into the card (its title), Tab stays inside it, Escape skips the tour, and focus goes back
 * where it was when the tour ends.
 */
export function TourOverlay({
  step,
  index,
  count,
  guide,
  onBack,
  onNext,
  onSkip,
  onPassOver,
}: {
  step: Step;
  index: number;
  count: number;
  guide: GuideCharacter;
  onBack: () => void;
  /** Next step, or finishing on the last. */
  onNext: () => void;
  onSkip: () => void;
  /** An optional step's element isn't on screen: move on in the same direction. */
  onPassOver: () => void;
}) {
  const router = useRouter();
  const phone = useMediaQuery('(max-width: 767px)');
  const titleId = useId();
  const bodyId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  // The step the card shows (the last one found), and its element (null: none, shown centred).
  const [shown, setShown] = useState<{ step: Step; index: number; el: Element | null } | null>(null);
  const [frame, setFrame] = useState<Frame>(() => ({ hole: centre(), card: null, ring: false }));
  const [closing, setClosing] = useState(false);
  const frameRef = useRef(frame);
  const cardSize = useRef({ width: 368, height: 240 });
  const moving = useRef(false);
  const motionFrame = useRef(0);
  // The latest props, for callbacks that outlive a render (timers, animation frames, listeners).
  const latest = useRef({ index, phone, onNext, onSkip, onPassOver });
  useLayoutEffect(() => {
    latest.current = { index, phone, onNext, onSkip, onPassOver };
  });
  // Between a click and the next step being on screen, the buttons wait.
  const busy = closing || shown?.step.id !== step.id;
  const last = (shown?.index ?? index) === count - 1;

  const paint = (f: Frame) => {
    frameRef.current = f;
    setFrame(f);
  };
  const cardFor = (hole: Box | null) => (latest.current.phone ? null : placeCard(hole, cardSize.current, viewport()));

  /** Glide from what's on screen to the step's element, scrolling the page to it at the same time. */
  const moveTo = (el: Element | null) => {
    cancelAnimationFrame(motionFrame.current);
    const v = viewport();
    const startY = window.scrollY;
    let endY = startY;
    if (el) {
      const sheet = latest.current.phone ? (cardRef.current?.offsetHeight ?? 260) : 0;
      const card = latest.current.phone ? 0 : cardSize.current.height;
      const wanted = scrollTarget(toBox(el.getBoundingClientRect()), v, startY, sheet, card);
      endY = Math.min(wanted, Math.max(0, document.documentElement.scrollHeight - v.height));
    }
    const from = frameRef.current;
    const finalHole = el
      ? { ...toBox(el.getBoundingClientRect()), top: el.getBoundingClientRect().top - (endY - startY) }
      : centre(v);
    const finalCard = cardFor(el ? finalHole : null);
    const fromCard = from.card ?? finalCard;
    // Longer scrolls take a little longer, so the page never races past.
    const duration = reducedMotion() ? 0 : Math.min(MAX_MOVE_MS, MOVE_MS + Math.abs(endY - startY) * 0.12);
    const started = performance.now();
    moving.current = true;
    const tick = (now: number) => {
      const t = duration === 0 ? 1 : Math.min(1, (now - started) / duration);
      const e = ease(t);
      if (endY !== startY) window.scrollTo(0, mix(startY, endY, e));
      const live = el ? toBox(el.getBoundingClientRect()) : centre(v);
      paint({
        hole: mixBox(from.hole, live, e),
        card:
          finalCard && fromCard
            ? { top: mix(fromCard.top, finalCard.top, e), left: mix(fromCard.left, finalCard.left, e) }
            : null,
        ring: Boolean(el),
      });
      if (t < 1) motionFrame.current = requestAnimationFrame(tick);
      else moving.current = false;
    };
    motionFrame.current = requestAnimationFrame(tick);
  };

  // Give focus back to where it was when the tour ends, and stop any motion.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    return () => {
      cancelAnimationFrame(motionFrame.current);
      before?.focus?.({ preventScroll: true });
    };
  }, []);

  // Open the step's page, then wait for its element to appear, and move to it.
  useEffect(() => {
    let cancelled = false;
    const target = step.target;
    const path = target ? router.buildLocation({ to: target.to, params: target.params } as never).pathname : null;
    const navigating = Boolean(path && router.state.location.pathname !== path);
    if (navigating) void router.navigate({ to: target!.to, params: target!.params } as never);
    const started = Date.now();
    const stepIndex = latest.current.index;
    let arrived: number | null = null;
    const show = (el: Element | null) => {
      setShown({ step, index: stepIndex, el });
      moveTo(el);
    };
    const look = () => {
      if (cancelled) return;
      const onPage = !path || router.state.location.pathname === path;
      if (onPage) arrived ??= Date.now();
      // Just after the address changes, the old page can still be on screen: give the new one a moment to render.
      const settled = onPage && (!navigating || Date.now() - arrived! >= SETTLE_MS);
      const el = findAnchor(step.anchor);
      if (settled && (el || !step.anchor)) return show(el);
      // An optional card that isn't on the page now won't be: decide quickly, unless the page has just opened and is
      // still loading.
      const optional = step.optional && arrived !== null;
      const waited = Date.now() - (optional ? arrived! : started);
      const limit = optional ? (navigating ? OPTIONAL_AFTER_LOAD_MS : OPTIONAL_MS) : FIND_MS;
      if (waited < limit) return void setTimeout(look, 60);
      if (step.optional) return latest.current.onPassOver();
      show(null);
    };
    look();
    return () => {
      cancelled = true;
    };
    // Each step looks once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id]);

  // Once there, follow the element as the page scrolls, resizes or reflows (and the page replacing it), and keep the
  // card beside it as its size changes. Paused while gliding between steps.
  useEffect(() => {
    if (!shown || shown.step.id !== step.id) return;
    let el = shown.el;
    const anchor = shown.step.anchor;
    let pending = 0;
    const update = () => {
      cancelAnimationFrame(pending);
      pending = requestAnimationFrame(() => {
        if (moving.current) return;
        if (el && !el.isConnected) {
          const again = findAnchor(anchor);
          if (!again) return;
          observer.disconnect();
          observer.observe(again);
          if (cardRef.current) observer.observe(cardRef.current);
          el = again;
        }
        const card = cardRef.current;
        if (card) cardSize.current = { width: card.offsetWidth, height: card.offsetHeight };
        const hole = el ? toBox(el.getBoundingClientRect()) : centre();
        paint({ hole, card: cardFor(el ? hole : null), ring: Boolean(el) });
      });
    };
    const observer = new ResizeObserver(update);
    if (el) observer.observe(el);
    if (cardRef.current) observer.observe(cardRef.current);
    const poll = setInterval(update, 300);
    window.addEventListener('scroll', update, { capture: true, passive: true });
    window.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(pending);
      clearInterval(poll);
      observer.disconnect();
      window.removeEventListener('scroll', update, { capture: true });
      window.removeEventListener('resize', update);
    };
  }, [shown, step.id, phone]);

  // Each step: focus its title, so screen readers read it and the keys below work.
  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, [shown?.step.id]);

  /** Fade the tour out, then finish or skip it. */
  const leave = (then: () => void) => {
    if (closing) return;
    setClosing(true);
    setTimeout(then, reducedMotion() ? 0 : FADE_MS);
  };

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      leave(() => latest.current.onSkip());
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  // Tab and Shift+Tab cycle through the card's buttons.
  const trap = (e: KeyboardEvent) => {
    if (e.key !== 'Tab' || !cardRef.current) return;
    const items = [...cardRef.current.querySelectorAll<HTMLElement>('button:not([disabled])')];
    if (items.length === 0) return;
    const first = items[0]!;
    const final = items[items.length - 1]!;
    if (e.shiftKey && (document.activeElement === first || document.activeElement === titleRef.current)) {
      e.preventDefault();
      final.focus();
    } else if (!e.shiftKey && document.activeElement === final) {
      e.preventDefault();
      first.focus();
    }
  };

  const g = GUIDES[guide];
  const { hole, card } = frame;

  return createPortal(
    <div
      className={cx('fixed inset-0 z-[70] animate-fade-in transition-opacity duration-200', closing && 'opacity-0')}
      data-tour-overlay=""
    >
      {/* Holds clicks off the page while the tour is open. */}
      <div aria-hidden className="absolute inset-0" />
      {/* The dimming, with a hole where the step's element is: always on screen, so steps never flash. */}
      <div
        aria-hidden
        className="pointer-events-none absolute rounded-[16px]"
        style={{
          top: hole.top - (frame.ring ? PAD : 0),
          left: hole.left - (frame.ring ? PAD : 0),
          width: hole.width + (frame.ring ? PAD * 2 : 0),
          height: hole.height + (frame.ring ? PAD * 2 : 0),
          boxShadow: `0 0 0 2px rgb(255 255 255 / ${frame.ring ? 0.9 : 0}), 0 0 0 200vmax rgb(16 20 18 / 0.55)`,
        }}
      />
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        aria-busy={busy || undefined}
        onKeyDown={trap}
        className={cx(
          'fixed border border-line-soft bg-surface p-5 shadow-2xl transition-opacity duration-200',
          phone
            ? 'inset-x-0 bottom-0 rounded-t-[22px] pb-[calc(1.25rem+env(safe-area-inset-bottom))]'
            : 'w-[min(23rem,calc(100vw-2rem))] rounded-card',
          shown ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        style={!phone && card ? { top: card.top, left: card.left } : undefined}
      >
        <div className="flex items-center gap-3.5">
          <span className="grid size-14 shrink-0 place-items-center rounded-full" style={{ backgroundColor: g.tint }}>
            <Guide character={guide} pose="pointing" size={52} ground={false} decorative />
          </span>
          <div key={shown?.step.id} className="min-w-0 animate-fade-in">
            <p className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">
              {g.name} · Step {(shown?.index ?? index) + 1} of {count}
            </p>
            <h2
              id={titleId}
              ref={titleRef}
              tabIndex={-1}
              className="mt-0.5 text-lg leading-snug font-bold text-ink focus:outline-none"
            >
              {shown?.step.title ?? step.title}
            </h2>
          </div>
        </div>
        <p key={shown?.step.id} id={bodyId} className="mt-3 animate-fade-in text-[15px] leading-relaxed text-ink/80">
          {shown?.step.body ?? step.body}
        </p>
        <div aria-hidden className="mt-4 flex gap-1">
          {Array.from({ length: count }, (_, i) => (
            <span
              key={i}
              className={cx(
                'h-1 flex-1 rounded-full transition-colors duration-300',
                i <= (shown?.index ?? index) ? 'bg-primary' : 'bg-line',
              )}
            />
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => leave(onSkip)}
            className="min-h-10 rounded-control px-1 text-sm font-semibold text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-blue-deep"
          >
            Skip tour
          </button>
          <div className="flex gap-2">
            {(shown?.index ?? index) > 0 && (
              <Button variant="secondary" size="sm" onClick={() => !busy && onBack()}>
                <ArrowLeft aria-hidden className="size-4" /> Back
              </Button>
            )}
            <Button size="sm" onClick={() => !busy && (last ? leave(onNext) : onNext())}>
              {last ? (
                'Finish'
              ) : (
                <>
                  Next <ArrowRight aria-hidden className="size-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
