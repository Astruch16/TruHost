import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { Spinner } from '../ui/spinner';

/**
 * The sign-in card and its parts, styled as in docs/design/Login.dc.html: frosted panel, TruHost badge, title and
 * subtitle, 48px fields, the dark green primary button and the white Google button.
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
    <div className="lg-rise flex w-[420px] max-w-full flex-col gap-3.5 rounded-[26px] border border-white/70 bg-[rgba(251,251,248,0.95)] px-5 pt-6 pb-5 text-ink sm:gap-[18px] sm:px-[34px] sm:pt-[34px] sm:pb-7 shadow-[0_30px_80px_rgba(4,14,12,0.5),inset_0_2px_0_rgba(255,255,255,0.8)] sm:px-[34px] sm:pt-[34px]">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="grid size-12 place-items-center rounded-2xl sm:size-14 bg-[linear-gradient(160deg,#24574F,#173F3A)] shadow-[0_8px_20px_rgba(23,63,58,0.35),inset_0_1px_0_rgba(255,255,255,0.25)]">
          <svg
            width="30"
            height="30"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 11l9-8 9 8v10H3z" />
            <path d="M10 13h4v4h-4z" stroke="#E2C15A" />
          </svg>
        </div>
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.02em] sm:text-2xl">{title}</h1>
          {subtitle && <div className="mt-0.5 text-[15px] text-muted">{subtitle}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}

/** The handwritten line under the card. */
export function AuthTagline() {
  return (
    <p
      aria-hidden
      className="lg-rise hidden -rotate-3 font-hand text-[30px] sm:block text-white/92 [animation-delay:.25s] [text-shadow:0_2px_12px_rgba(0,0,0,0.35)]"
    >
      Better stays. Higher returns.
    </p>
  );
}

const fieldInput =
  'lg-input h-12 w-full rounded-xl border border-[#DADDD7] bg-white px-3.5 text-[15px] text-ink placeholder:text-muted/70';

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

/** The dark green primary button. */
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
        'lg-btn flex h-[50px] items-center justify-center gap-2 rounded-xl bg-[linear-gradient(180deg,#24574F,#173F3A)] text-base font-bold text-white shadow-[0_8px_18px_rgba(23,63,58,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] disabled:opacity-70',
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
        'lg-ghost flex h-12 items-center justify-center gap-2.5 rounded-xl border border-[#DADDD7] bg-white text-[15px] font-semibold text-ink disabled:opacity-70',
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
      className="rounded text-[13px] font-semibold text-[#173F3A] hover:text-[#0E2A26] hover:underline"
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
