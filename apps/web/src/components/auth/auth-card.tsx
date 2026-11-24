import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { cx } from '../../lib/cx';
import loginMarkUrl from '../../assets/brand/login-mark.webp?url';
import wordmarkUrl from '../../assets/brand/truhost-wordmark-light.svg?url';
import { Spinner } from '../ui/spinner';

/**
 * The sign-in card and its parts: a frosted-glass card (styles.css, .lg-glass) with a soft shadow on the white page,
 * the TruHost mark (assets/brand/login-mark.webp, the cream and light green monogram on a dark green tile),
 * title and subtitle, 48px fields, the green primary button and the white Google button. Layout from
 * docs/design/Login.dc.html.
 */
export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="lg-rise flex w-[420px] max-w-full flex-col gap-3.5 rounded-[26px] lg-glass border border-white/65 px-5 pt-6 pb-5 text-ink shadow-[0_1px_3px_rgba(16,24,40,0.06),0_14px_36px_-6px_rgba(16,24,40,0.12),inset_0_1px_0_rgba(255,255,255,0.85)] sm:gap-[18px] sm:px-[34px] sm:pt-[34px] sm:pb-7">
      <div className="flex flex-col items-center gap-3 text-center">
        <img
          src={loginMarkUrl}
          alt=""
          width={56}
          height={56}
          draggable={false}
          className="size-12 select-none sm:size-14"
        />
        <div>
          <h1 className="font-display text-[1.5rem] leading-tight font-semibold tracking-[-0.015em] sm:text-[1.75rem]">
            {title}
          </h1>
          {subtitle && <div className="mt-0.5 text-[15px] text-muted">{subtitle}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}

/** The TruHost mark and wordmark (assets/brand/truhost-wordmark-light.svg), in the sign-in page's top-left corner. */
export function AuthBrand() {
  return (
    <div className="flex items-center gap-2.5">
      <img
        src={loginMarkUrl}
        alt=""
        width={40}
        height={40}
        draggable={false}
        className="size-9 select-none sm:size-10"
      />
      <img
        src={wordmarkUrl}
        alt="TruHost"
        width={90}
        height={22}
        draggable={false}
        className="h-5 w-auto select-none sm:h-[22px]"
      />
    </div>
  );
}

/** The handwritten line under the card, set level (wider screens only). */
export function AuthTagline() {
  return (
    <p aria-hidden className="lg-rise hidden font-hand text-[30px] text-ink sm:block [animation-delay:.25s]">
      Better stays. Higher returns.
    </p>
  );
}

const fieldInput =
  'lg-input h-12 w-full rounded-xl border border-[#DADDD7] bg-white/72 px-3.5 text-[15px] text-ink placeholder:text-muted/70';

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
        <label htmlFor={id} className="text-sm font-semibold">
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
        <label htmlFor={id} className="text-sm font-semibold">
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
          className="absolute top-1 right-1 grid size-10 place-items-center rounded-[9px] text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-[rgba(23,63,58,0.35)]"
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

/** The green primary button: slightly see-through, with a darker green outline. */
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
        'lg-btn flex h-[50px] items-center justify-center gap-2 rounded-xl border border-[#173F3A] bg-[linear-gradient(180deg,rgba(47,111,98,0.9),rgba(37,92,81,0.9))] text-base font-bold text-white shadow-[0_6px_16px_rgba(23,63,58,0.22),inset_0_1px_0_rgba(255,255,255,0.22)] disabled:opacity-70',
        loading && 'cursor-progress',
      )}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
}

/** "Continue with Google", the white button with Google's mark. */
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
        'lg-ghost flex h-12 items-center justify-center gap-2.5 rounded-xl border border-[#DADDD7] bg-white/72 text-[15px] font-semibold text-ink disabled:opacity-70',
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

/** "or with email". */
export function AuthDivider({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-[13px] text-muted">
      <span className="h-px flex-1 bg-line" />
      {children}
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

/** A text link styled as on the board ("Forgot password?", "Back to sign in"). */
export function AuthLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[13px] font-semibold text-[#173F3A] hover:text-[#0E2A26] link-underline"
    >
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

/** Small print at the bottom of the card. */
export function AuthNote({ children }: { children: ReactNode }) {
  return <p className="pt-0.5 text-center text-[13px] leading-normal text-muted">{children}</p>;
}
