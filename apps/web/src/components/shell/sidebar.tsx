import { Link } from '@tanstack/react-router';
import { CircleHelp, LogOut } from 'lucide-react';
import { cx } from '../../lib/cx';
import type { NavItem } from '../../lib/nav';
import { APP_BUILD, APP_VERSION } from '../../lib/version';
import { Logo } from './logo';
import { MountainScene } from './mountain-scene';

const itemClass = cx(
  'group flex min-h-12 items-center gap-3 rounded-control px-3.5 text-base font-medium text-sidebar-ink/90',
  'transition-colors hover:bg-sidebar-hover hover:text-sidebar-ink',
  'focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-sidebar-ink',
  'data-[status=active]:bg-sidebar-active data-[status=active]:font-semibold data-[status=active]:text-white',
);

export function Sidebar({
  items,
  onSignOut,
  onHelp,
  onNavigate,
}: {
  items: NavItem[];
  onSignOut: () => void;
  onHelp?: () => void;
  onNavigate?: () => void;
}) {
  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-sidebar">
      <div className="px-6 pt-7 pb-8">
        <Link to="/" onClick={onNavigate} className="inline-block rounded-control focus-visible:outline-sidebar-ink">
          <Logo />
        </Link>
      </div>
      {/* On a short screen the scene below gives way first, then the nav scrolls, so the foot stays in view. */}
      <nav aria-label="Main" className="scroll-area relative z-10 min-h-0 flex-initial overflow-y-auto px-3 py-0.5">
        <ul className="flex flex-col gap-1">
          {items.map(({ to, label, icon: Icon, badge, exact }) => (
            <li key={to}>
              <Link to={to} onClick={onNavigate} className={itemClass} activeOptions={{ exact: exact ?? false }}>
                <Icon aria-hidden className="size-[18px] shrink-0 opacity-90" strokeWidth={1.75} />
                <span className="flex-1">{label}</span>
                {badge ? (
                  <span className="grid min-w-6 place-items-center rounded-full bg-white/15 px-1.5 text-xs font-semibold text-white">
                    {badge}
                    <span className="sr-only"> needing attention</span>
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Decorative foot: a size container, so the scene and tagline appear only when there is real room below the
          nav (styles.css: .sidebar-foot). It never overlaps nav items, whatever the screen height or item count. */}
      <div
        aria-hidden
        className="sidebar-foot pointer-events-none relative mt-auto min-h-0 flex-1 basis-0 overflow-hidden"
      >
        <MountainScene className="sidebar-scene absolute inset-x-0 bottom-0 h-[min(330px,100%)] w-full" />
        <p className="sidebar-tagline absolute inset-x-0 bottom-[296px] -rotate-3 px-6 text-center font-hand text-[1.75rem] leading-[1.15] text-sidebar-ink/90">
          Better stays.
          <br />
          Higher returns.
        </p>
      </div>

      {/* Foot: Help, Log out and the version, on the scene's darkest ground so the trees run into it. Always at the bottom;
          the scene above gives way first on short screens. */}
      <div className="relative z-10 flex-none bg-[#0e2421] px-3 pt-1 pb-4">
        {onHelp && (
          <button type="button" onClick={onHelp} className={cx(itemClass, 'w-full text-left')}>
            <CircleHelp aria-hidden className="size-[18px] shrink-0 opacity-90" strokeWidth={1.75} />
            <span className="flex-1">Help</span>
          </button>
        )}
        <button type="button" onClick={onSignOut} className={cx(itemClass, 'w-full text-left')}>
          <LogOut aria-hidden className="size-[18px] shrink-0 opacity-90" strokeWidth={1.75} />
          <span className="flex-1">Log out</span>
        </button>
        <p className="figure mt-1 px-3.5 text-xs text-sidebar-muted/80">
          TruHost {APP_VERSION}
          <span aria-hidden> · </span>
          <span className="sr-only">, build </span>
          {APP_BUILD}
        </p>
      </div>
    </div>
  );
}
