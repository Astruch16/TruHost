import { Link } from '@tanstack/react-router';
import { Bell, ShieldCheck, SlidersHorizontal, UserRound } from 'lucide-react';
import { cx } from '../../lib/cx';

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
 * The Settings sections: a column of links with a line about each on wide screens, a row of tabs that scrolls
 * sideways on phones.
 */
export function SettingsNav({
  preview,
}: {
  /** Dev preview only: highlight this section and report clicks instead of navigating. */
  preview?: { active: string; onPick: (to: string) => void };
}) {
  return (
    <nav aria-label="Settings">
      <ul className="scroll-area -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 @4xl/content:mx-0 @4xl/content:flex-col @4xl/content:gap-1 @4xl/content:overflow-visible @4xl/content:px-0 @4xl/content:pb-0">
        {SECTIONS.map(({ to, label, hint, icon: Icon, exact }) => (
          <li key={to} className="shrink-0">
            <Link
              to={to}
              activeOptions={{ exact }}
              {...(preview && {
                'data-status': preview.active === to ? 'active' : undefined,
                onClick: (e: { preventDefault: () => void }) => {
                  e.preventDefault();
                  preview.onPick(to);
                },
              })}
              className={cx(
                'group flex items-center gap-3 rounded-full border border-line bg-surface py-1.5 pr-4 pl-1.5 text-sm font-semibold text-ink transition-colors',
                'hover:border-ink/20 focus-visible:outline-2 focus-visible:outline-blue-deep',
                'data-[status=active]:border-primary data-[status=active]:bg-primary data-[status=active]:text-white',
                '@4xl/content:rounded-inner @4xl/content:border-transparent @4xl/content:bg-transparent @4xl/content:p-2.5',
                '@4xl/content:hover:border-transparent @4xl/content:hover:bg-ink/5',
                '@4xl/content:data-[status=active]:border-line-soft @4xl/content:data-[status=active]:bg-surface @4xl/content:data-[status=active]:text-ink @4xl/content:data-[status=active]:shadow-sm',
              )}
            >
              <span
                className={cx(
                  'grid size-7 shrink-0 place-items-center rounded-full bg-ground text-muted transition-colors',
                  'group-data-[status=active]:bg-white/15 group-data-[status=active]:text-white',
                  '@4xl/content:size-9 @4xl/content:rounded-[10px]',
                  '@4xl/content:group-data-[status=active]:bg-sage-tint @4xl/content:group-data-[status=active]:text-sage-deep',
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
