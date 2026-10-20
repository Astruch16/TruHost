import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from '@tanstack/react-router';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { cx } from '../../lib/cx';
import { GUIDES, type GuideCharacter } from '../../lib/guides';
import { placeCard, scrollTarget, type Box } from '../../lib/tour-position';
import type { TourPage, TourStep } from '../../lib/tours';
import { useMediaQuery, useWindowSize } from '../../lib/use-viewport';
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

const visible = (el: Element) => el.getClientRects().length > 0;
/** The step's element, if one is on screen. */
const findAnchor = (anchor: string | undefined): Element | null =>
  (anchor && [...document.querySelectorAll(`[data-tour="${anchor}"]`)].find(visible)) || null;
const toBox = (r: DOMRect): Box => ({ top: r.top, left: r.left, width: r.width, height: r.height });
const reducedMotion = () =>
  document.documentElement.dataset.motion === 'reduced' ||
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * One step of a welcome tour: the page dims around the element the step is about, and the guide (pointing) explains
 * it in a card beside it, or in a bottom sheet on phones. The step's page is opened first if the user is elsewhere.
 * A step whose element isn't there shows centred, or is passed over when it's optional.
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
  step: TourStep & { target: TourPage | null };
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
  const view = useWindowSize();
  const titleId = useId();
  const bodyId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  // The element the step points at (null: none, shown centred), once it has been looked for.
  const [found, setFound] = useState<{ stepId: string; el: Element | null } | null>(null);
  // Where it is on screen, measured for this step.
  const [measured, setMeasured] = useState<{ stepId: string; box: Box } | null>(null);
  const [cardSize, setCardSize] = useState({ width: 368, height: 240 });
  const last = index === count - 1;
  const ready = found?.stepId === step.id;
  const anchor = ready ? found.el : null;
  const rect = anchor && measured?.stepId === step.id ? measured.box : null;

  // Give focus back to where it was when the tour ends.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    return () => before?.focus?.({ preventScroll: true });
  }, []);

  // Open the step's page, then wait for its element to appear.
  useEffect(() => {
    let cancelled = false;
    const target = step.target;
    const path = target ? router.buildLocation({ to: target.to, params: target.params } as never).pathname : null;
    const navigating = Boolean(path && router.state.location.pathname !== path);
    if (navigating) void router.navigate({ to: target!.to, params: target!.params } as never);
    const started = Date.now();
    let arrived: number | null = null;
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
      if (step.optional) return onPassOver();
      show(null);
    };
    const show = (el: Element | null) => {
      if (el) {
        const sheet = phone ? (cardRef.current?.offsetHeight ?? 260) : 0;
        const card = phone ? 0 : (cardRef.current?.offsetHeight ?? 240);
        const top = scrollTarget(toBox(el.getBoundingClientRect()), view, window.scrollY, sheet, card);
        window.scrollTo({ top, behavior: reducedMotion() ? 'auto' : 'smooth' });
      }
      setFound({ stepId: step.id, el });
    };
    look();
    return () => {
      cancelled = true;
    };
    // Each step looks once; the viewport is read when it's shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id]);

  // Follow the element as the page scrolls, resizes or reflows; if the page replaces it, follow the new one.
  useEffect(() => {
    if (!anchor) return;
    const stepId = step.id;
    let el = anchor;
    let frame = 0;
    const observer = new ResizeObserver(() => update());
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!el.isConnected) {
          const again = findAnchor(step.anchor);
          if (!again) return;
          observer.disconnect();
          observer.observe(again);
          el = again;
        }
        setMeasured({ stepId, box: toBox(el.getBoundingClientRect()) });
      });
    };
    update();
    observer.observe(el);
    const poll = setInterval(update, 300);
    window.addEventListener('scroll', update, { capture: true, passive: true });
    window.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(poll);
      observer.disconnect();
      window.removeEventListener('scroll', update, { capture: true });
      window.removeEventListener('resize', update);
    };
  }, [anchor, step.id, step.anchor]);

  // The card's size, for placing it beside the element.
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const observer = new ResizeObserver(() => setCardSize({ width: card.offsetWidth, height: card.offsetHeight }));
    observer.observe(card);
    return () => observer.disconnect();
  }, []);

  // Each step: focus its title, so screen readers read it and the keys below work.
  useEffect(() => {
    if (ready) titleRef.current?.focus({ preventScroll: true });
  }, [ready, step.id]);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onSkip();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onSkip]);

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

  const position = phone ? null : placeCard(rect, cardSize, view);
  const g = GUIDES[guide];

  return createPortal(
    <div className="fixed inset-0 z-[70]" data-tour-overlay="">
      {/* Holds clicks off the page while the tour is open; dims the page when there's nothing to point at. */}
      <div aria-hidden className={cx('absolute inset-0 transition-colors', !rect && ready && 'bg-ink/55')} />
      {rect && (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-[16px] ring-2 ring-white/90 transition-[top,left,width,height] duration-300 ease-out"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: '0 0 0 200vmax rgb(16 20 18 / 0.55)',
          }}
        />
      )}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        onKeyDown={trap}
        className={cx(
          'fixed border border-line-soft bg-surface p-5 shadow-2xl transition-opacity duration-200',
          phone
            ? 'inset-x-0 bottom-0 rounded-t-[22px] pb-[calc(1.25rem+env(safe-area-inset-bottom))]'
            : 'w-[min(23rem,calc(100vw-2rem))] rounded-card',
          ready ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        style={position ? { top: position.top, left: position.left } : undefined}
      >
        <div className="flex items-center gap-3.5">
          <span className="grid size-14 shrink-0 place-items-center rounded-full" style={{ backgroundColor: g.tint }}>
            <Guide character={guide} pose="pointing" size={52} ground={false} decorative />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">
              {g.name} · Step {index + 1} of {count}
            </p>
            <h2
              id={titleId}
              ref={titleRef}
              tabIndex={-1}
              className="mt-0.5 text-lg leading-snug font-bold text-ink focus:outline-none"
            >
              {step.title}
            </h2>
          </div>
        </div>
        <p id={bodyId} className="mt-3 text-[15px] leading-relaxed text-ink/80">
          {step.body}
        </p>
        <div aria-hidden className="mt-4 flex gap-1">
          {Array.from({ length: count }, (_, i) => (
            <span key={i} className={cx('h-1 flex-1 rounded-full', i <= index ? 'bg-primary' : 'bg-line')} />
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onSkip}
            className="min-h-10 rounded-control px-1 text-sm font-semibold text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-blue-deep"
          >
            Skip tour
          </button>
          <div className="flex gap-2">
            {index > 0 && (
              <Button variant="secondary" size="sm" onClick={onBack}>
                <ArrowLeft aria-hidden className="size-4" /> Back
              </Button>
            )}
            <Button size="sm" onClick={onNext}>
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
