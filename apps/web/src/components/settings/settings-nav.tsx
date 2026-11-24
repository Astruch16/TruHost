import { useEffect, useRef } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { Bell, ShieldCheck, SlidersHorizontal, UserRound } from 'lucide-react';
import { cx } from '../../lib/cx';
import { useSlidingHighlight } from '../../lib/motion';
import { activeNavPath } from '../../lib/nav';

const SECTIONS = [
  { to: '/account', label: 'Profile', hint: 'Photo, name and contact', icon: UserRound, exact: true },
  { to: '/account/security', label: 'Security', hint: 'Password, two-step, devices', icon: ShieldCheck, exact: false },
  { to: '/account/notifications', label: 'Notifications', hint: 'What we tell you about', icon: Bell, exact: false },
  {
    to: '/account/preferences',
    label: 'Preferences',
    hint: 'Guide, calendar and motion',
    icon: SlidersHorizontal,
    exact: false,
  },
] as const;

/**
 * The Settings sections, with one sky highlight that slides to the open section (as in the sidebar). Wide screens:
 * a card beside the section, a line about each. Phones: a row of pills that scrolls sideways.
 */
export function SettingsNav({
  preview,
}: {
  /** Dev preview only: highlight this section and report clicks instead of navigating. */
  preview?: { active: string; onPick: (to: string) => void };
}) {
  const list = useRef<HTMLUListElement>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = preview?.active ?? activeNavPath(SECTIONS, pathname) ?? '';
  const { style, ready } = useSlidingHighlight(list, active);
  // Phones: bring the open section's pill into view in the sideways row (moving only the row, never the page).
  useEffect(() => {
    const row = list.current;
    const pill = row?.querySelector<HTMLElement>(`[data-option="${CSS.escape(active)}"]`);
    if (!row || !pill || row.scrollWidth <= row.clientWidth) return;
    const left = pill.offsetLeft - 16;
    const right = pill.offsetLeft + pill.offsetWidth + 16 - row.clientWidth;
    if (left < row.scrollLeft) row.scrollLeft = left;
    else if (right > row.scrollLeft) row.scrollLeft = right;
  }, [active]);

  return (
    <nav
      aria-label="Settings"
      className="@4xl/content:rounded-card @4xl/content:border @4xl/content:border-line-soft @4xl/content:bg-surface @4xl/content:p-2"
    >
      <ul
        ref={list}
        className="scroll-area relative isolate -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 @4xl/content:mx-0 @4xl/content:flex-col @4xl/content:gap-0.5 @4xl/content:overflow-visible @4xl/content:px-0 @4xl/content:pb-0"
      >
        <span
          aria-hidden
          className={cx(
            'pointer-events-none absolute top-0 left-0 -z-10 rounded-full bg-sky-tint @4xl/content:rounded-inner',
            ready && 'transition-[transform,width,height] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
          )}
          style={style}
        />
        {SECTIONS.map(({ to, label, hint, icon: Icon, exact }) => (
          <li key={to} className="shrink-0">
            <Link
              to={to}
              data-option={to}
              activeOptions={{ exact }}
              {...(preview && {
                'data-status': preview.active === to ? 'active' : undefined,
                onClick: (e: { preventDefault: () => void }) => {
                  e.preventDefault();
                  preview.onPick(to);
                },
              })}
              className={cx(
                'group flex items-center gap-3 rounded-full border border-line py-1.5 pr-4 pl-1.5 text-sm font-semibold text-muted transition-colors',
                'hover:text-ink focus-visible:outline-2 focus-visible:outline-sky-deep',
                'data-[status=active]:border-transparent data-[status=active]:text-ink',
                '@4xl/content:rounded-inner @4xl/content:border-0 @4xl/content:p-2.5',
              )}
            >
              <span
                className={cx(
                  'grid size-7 shrink-0 place-items-center rounded-full bg-ground text-muted transition-colors',
                  'group-data-[status=active]:bg-primary group-data-[status=active]:text-white',
                  '@4xl/content:size-9 @4xl/content:rounded-[10px]',
                )}
              >
                <Icon aria-hidden className="size-4" />
              </span>
              <span className="leading-tight">
                <span className="block">{label}</span>
                <span className="hidden text-xs font-normal text-muted @4xl/content:block">{hint}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
