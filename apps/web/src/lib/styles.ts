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

export type PillTone = 'dark' | 'blue' | 'lavender' | 'sage' | 'neutral' | 'danger';

export const pillStyles = (tone: PillTone) =>
  cx(
    'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
    tone === 'dark' && 'bg-ink text-white',
    tone === 'blue' && 'bg-blue-tint text-blue-deep',
    tone === 'lavender' && 'bg-lavender-tint text-lavender-deep',
    tone === 'sage' && 'bg-sage-tint text-sage-deep',
    tone === 'neutral' && 'bg-line-soft text-muted',
    tone === 'danger' && 'bg-danger-tint text-danger-deep',
  );

/**
 * Shared look for every dropdown surface (selects, profile menu, property switcher, notifications): rounded
 * panel, soft shadow, enter/exit animation. Motion is disabled under prefers-reduced-motion (styles.css).
 */
export const menuSurfaceStyles = cx(
  'z-50 overflow-hidden rounded-inner border border-line bg-surface p-1.5',
  'shadow-[0_16px_40px_-16px_rgba(26,29,33,0.28)]',
  'data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out',
);

/** One row in a dropdown: rounded, with a faint sage tint that fades in on hover or keyboard highlight. */
export const menuItemStyles = cx(
  'relative flex min-h-10 w-full cursor-pointer items-center gap-2.5 rounded-control-sm px-3 text-left text-sm text-ink outline-none select-none',
  'transition-[background-color,color] duration-150 ease-out',
  'hover:bg-sage-tint/60 hover:text-sage-deep focus-visible:bg-sage-tint/60 focus-visible:text-sage-deep',
  'data-[highlighted]:bg-sage-tint/60 data-[highlighted]:text-sage-deep',
  'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
);
