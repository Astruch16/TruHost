/** TruHost house mark + wordmark, as on the sidebar. */
export function Logo() {
  return (
    <div className="flex items-center gap-3">
      <svg aria-hidden viewBox="0 0 40 40" className="size-10 shrink-0 text-sidebar-ink">
        <path
          d="M6 18.5 20 6.5l14 12V33a1.5 1.5 0 0 1-1.5 1.5h-25A1.5 1.5 0 0 1 6 33z"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <rect x="16" y="20" width="8" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="2.5" />
      </svg>
      <div className="leading-tight">
        <p className="text-2xl font-bold tracking-tight text-sidebar-ink">TruHost</p>
        <p className="mt-0.5 text-[0.62rem] font-semibold tracking-[0.12em] text-sidebar-muted uppercase">
          Vacation rental
          <br />
          management
        </p>
      </div>
    </div>
  );
}
