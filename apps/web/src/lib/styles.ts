import { cx } from './cx';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger' | 'danger-solid';
export type ButtonSize = 'sm' | 'md';

/**
 * Button classes, shared by <Button> and by router <Link>s that should look like buttons.
 * Motion is limited to color/border/shadow transitions on state change.
 */
export function buttonStyles({
  variant = 'primary',
  size = 'md',
  block = false,
}: { variant?: ButtonVariant; size?: ButtonSize; block?: boolean } = {}) {
  return cx(
    'inline-flex shrink-0 select-none items-center justify-center gap-2 font-semibold whitespace-nowrap',
    'transition-[background-color,border-color,color,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2',
    'disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50',
    size === 'md' ? 'min-h-11 rounded-control px-4 text-sm' : 'min-h-9 rounded-control-sm px-3 text-sm',
    block && 'w-full',
    variant === 'primary' &&
      'bg-primary text-primary-ink hover:bg-primary-hover focus-visible:outline-primary disabled:hover:bg-primary',
    variant === 'secondary' &&
      'border border-line bg-surface text-ink hover:border-ink/30 hover:bg-ground focus-visible:outline-blue-deep',
    variant === 'quiet' && 'text-muted hover:bg-ink/5 hover:text-ink focus-visible:outline-blue-deep',
    variant === 'danger' &&
      'border border-danger-line bg-surface text-danger-deep hover:bg-danger-tint focus-visible:outline-danger-deep',
    // Final confirmation of a destructive action (inside ConfirmDialog only).
    variant === 'danger-solid' &&
      'bg-danger-deep text-white hover:bg-danger-deep/90 focus-visible:outline-danger-deep disabled:hover:bg-danger-deep',
  );
}

/** Shared look for text inputs and selects. */
export const controlStyles = cx(
  'min-h-11 w-full rounded-control border border-line bg-surface px-3.5 text-base text-ink sm:text-sm',
  'placeholder:text-muted/70 transition-[border-color,box-shadow]',
  'hover:border-ink/25 focus-visible:border-blue-deep focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-blue-tint',
  'disabled:cursor-not-allowed disabled:bg-ground disabled:text-muted',
  'aria-invalid:border-danger-deep aria-invalid:focus-visible:ring-danger-tint',
);

export type PillTone = 'dark' | 'blue' | 'lavender' | 'sage' | 'amber' | 'neutral' | 'danger';

/**
 * A pill: a soft tint lit from above (a white wash and a hairline highlight along the top), a hairline ring in the
 * tone's own colour, and a dot with a faint halo before the label. Dark is for the urgent and the few top-level labels.
 */
export const pillStyles = (tone: PillTone) =>
  cx(
    'inline-flex items-center gap-1.5 rounded-full py-[3px] pr-2.5 pl-2 text-[11.5px] leading-4 font-semibold tracking-[0.01em] whitespace-nowrap',
    'bg-linear-to-b ring-1 ring-inset',
    tone === 'dark'
      ? 'bg-ink from-white/14 to-white/0 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.14),0_1px_2px_rgb(16_20_18/0.18)] ring-black/30'
      : 'from-white/60 to-white/0 shadow-[inset_0_1px_0_rgb(255_255_255/0.7),0_1px_2px_rgb(16_20_18/0.04)]',
    tone === 'blue' && 'bg-blue-tint text-blue-deep ring-blue-mid/25',
    tone === 'lavender' && 'bg-lavender-tint text-lavender-deep ring-lavender-mid/25',
    tone === 'sage' && 'bg-sage-tint text-sage-deep ring-sage-mid/25',
    tone === 'amber' && 'bg-amber-tint text-amber-deep ring-amber-mid/30',
    tone === 'neutral' && 'bg-ground text-muted ring-line',
    tone === 'danger' && 'bg-danger-tint text-danger-deep ring-danger-mid/25',
  );

/** The dot before a pill's label: the tone's mid colour, with a halo of itself. */
export const pillDotStyles = (tone: PillTone) =>
  cx(
    'size-1.5 shrink-0 rounded-full ring-[2.5px]',
    tone === 'dark' && 'bg-amber-light ring-amber-light/20',
    tone === 'blue' && 'bg-blue-mid ring-blue-mid/18',
    tone === 'lavender' && 'bg-lavender-mid ring-lavender-mid/18',
    tone === 'sage' && 'bg-sage-mid ring-sage-mid/18',
    tone === 'amber' && 'bg-amber-mid ring-amber-mid/20',
    tone === 'neutral' && 'bg-muted/45 ring-muted/10',
    tone === 'danger' && 'bg-danger-mid ring-danger-mid/18',
  );

/**
 * Shared look for every dropdown surface (selects, profile menu, property switcher, notifications): rounded
 * panel, soft shadow, enter/exit animation. Motion is disabled under prefers-reduced-motion (styles.css).
 */
/**
 * Content showing the previous month while the next one loads: dimmed (no skeleton, no jump), back to full strength
 * when the new figures arrive. Pair with aria-busy.
 */
export const updatingStyles = (updating: boolean) =>
  cx('transition-opacity duration-200', updating && 'pointer-events-none opacity-55');

/**
 * A page while it switches to another property: the current figures stay, softly dimmed, and the next ones fade in
 * (a gentler, slower change than `updatingStyles`, since the whole page changes).
 */
export const switchingStyles = (switching: boolean) =>
  cx('transition-opacity duration-300 ease-out motion-reduce:transition-none', switching && 'opacity-60');

export const menuSurfaceStyles = cx(
  'z-50 overflow-hidden rounded-inner border border-line bg-surface p-1.5',
  'shadow-[0_16px_40px_-16px_rgba(26,29,33,0.28)]',
  'data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out',
);

/** One row in a dropdown: rounded, with a faint sage tint that fades in on hover or keyboard highlight. */
export const menuItemStyles = cx(
  'relative flex min-h-10 w-full items-center gap-2.5 rounded-control-sm px-3 text-left text-sm text-ink outline-none select-none',
  'transition-[background-color,color] duration-150 ease-out',
  'hover:bg-sage-tint/60 hover:text-sage-deep focus-visible:bg-sage-tint/60 focus-visible:text-sage-deep',
  'data-[highlighted]:bg-sage-tint/60 data-[highlighted]:text-sage-deep',
  'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
);
