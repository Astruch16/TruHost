import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { cx } from '../../lib/cx';
import loginMarkUrl from '../../assets/brand/login-mark.webp?url';
import wordmarkUrl from '../../assets/brand/truhost-wordmark-light.svg?url';
import { Spinner } from '../ui/spinner';

/**
 * The sign-in page and its parts, in the style of a clean single-column sign-in: no card, just the content on the
 * white page under the logo (AuthFrame), with pill-shaped fields, a flat blue pill button and a soft grey pill for
 * Continue with Google.
 */
export function AuthCard({
  title,
  subtitle,
  titleHidden = false,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Keep the title for screen readers only (the sign-in step, where the logo and the form say enough). */
  titleHidden?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="lg-rise flex w-[388px] max-w-full flex-col gap-4 text-ink">
      <div className={cx('text-center', titleHidden && 'sr-only')}>
        <h1 className="font-display text-2xl leading-tight font-semibold tracking-[-0.015em]">{title}</h1>
        {subtitle && <div className="mt-1 text-[15px] text-muted">{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

/** The TruHost mark and wordmark (assets/brand/truhost-wordmark-light.svg), centred at the top of the sign-in page. */
export function AuthBrand() {
  return (
    <div className="lg-rise flex items-center gap-3">
      <img
        src={loginMarkUrl}
        alt=""
        width={48}
        height={48}
        draggable={false}
        className="size-11 select-none sm:size-12"
      />
      <img
        src={wordmarkUrl}
        alt="TruHost"
        width={131}
        height={32}
        draggable={false}
        className="h-7 w-auto select-none sm:h-8"
      />
    </div>
  );
}

const fieldInput =
  'lg-input h-11 w-full rounded-full border border-[#D3D8DF] bg-white px-4 text-[15px] text-ink placeholder:text-muted/70';

/** Label, input and an optional link on the label's line (e.g. "Forgot password?"). */
export function AuthField({
  label,
  aside,
  invalid,
  ...input
}: { label: string; aside?: ReactNode; invalid?: boolean } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {aside}
      </div>
      <input id={id} aria-invalid={invalid || undefined} className={fieldInput} {...input} />
    </div>
  );
}

/** Password field with the show/hide toggle from the board. */
export function PasswordField({
  label,
  aside,
  invalid,
  ...input
}: { label: string; aside?: ReactNode; invalid?: boolean } & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const id = useId();
  const [shown, setShown] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {aside}
      </div>
      <div className="relative">
        <input
          id={id}
          type={shown ? 'text' : 'password'}
          aria-invalid={invalid || undefined}
          className={cx(fieldInput, 'pr-12')}
          {...input}
        />
        <button
          type="button"
          onClick={() => setShown(!shown)}
          aria-label={shown ? 'Hide password' : 'Show password'}
          aria-pressed={shown}
          className="absolute top-0.5 right-1.5 grid size-10 place-items-center rounded-full text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-[rgba(31,120,189,0.4)]"
        >
          <svg
            width="19"
            height="19"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
            <circle cx="12" cy="12" r="3" />
            {shown && <path d="M4 4l16 16" />}
          </svg>
        </button>
      </div>
    </div>
  );
}

/** The primary button: a flat blue pill. */
export function AuthButton({
  children,
  loading = false,
  disabled,
  type = 'submit',
  onClick,
}: {
  children: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  type?: 'submit' | 'button';
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'lg-btn flex h-11 items-center justify-center gap-2 rounded-full bg-primary text-[15px] font-semibold text-white hover:bg-primary-hover disabled:opacity-70',
        loading && 'cursor-progress',
      )}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
}

/** "Continue with Google": a soft grey pill with Google's mark. */
export function GoogleButton({
  onClick,
  loading = false,
  disabled,
}: {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={cx(
        'lg-ghost flex h-11 items-center justify-center gap-2.5 rounded-full bg-[#F1F3F6] text-[15px] font-medium text-ink disabled:opacity-70',
        loading && 'cursor-progress',
      )}
    >
      {loading ? (
        <Spinner className="size-4" />
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z"
            fill="#4285F4"
          />
          <path
            d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z"
            fill="#34A853"
          />
          <path d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2z" fill="#FBBC05" />
          <path
            d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.4L6.4 10c.8-2.4 3-4.1 5.6-4.1z"
            fill="#EA4335"
          />
        </svg>
      )}
      Continue with Google
    </button>
  );
}

/** The "or" between the form and Continue with Google. */
export function AuthDivider({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-4 py-1 text-sm text-muted">
      <span className="h-px flex-1 bg-line-soft" />
      {children}
      <span className="h-px flex-1 bg-line-soft" />
    </div>
  );
}

/** A text link styled as on the board ("Forgot password?", "Back to sign in"). */
export function AuthLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-sm text-primary hover:text-primary-hover link-underline">
      {children}
    </button>
  );
}

/** An error the user can act on, announced to screen readers. */
export function AuthError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className="rounded-xl border border-danger-line bg-danger-tint px-3.5 py-2.5 text-sm text-danger-deep"
    >
      {children}
    </p>
  );
}

/** Small print at the foot of the page, under a hairline. */
export function AuthNote({ children }: { children: ReactNode }) {
  return (
    <p className="mt-2 border-t border-line-soft pt-5 text-center text-[13px] leading-normal text-muted">{children}</p>
  );
}
