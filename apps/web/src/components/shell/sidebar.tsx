import { useRef } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { CircleHelp, LogOut } from 'lucide-react';
import { cx } from '../../lib/cx';
import { useSlidingHighlight } from '../../lib/motion';
import { activeNavPath, navGroups, type NavItem } from '../../lib/nav';
import { APP_BUILD, APP_VERSION } from '../../lib/version';
import { Logo } from './logo';
import { NavScene } from './nav-scene';

const itemClass = cx(
  'group flex min-h-10 items-center gap-3 rounded-control px-3.5 text-base font-medium text-sidebar-ink/90',
  // The active item's background is the sliding highlight behind the list, so hovering it doesn't repaint it.
  'transition-colors hover:text-sidebar-ink hover:not-data-[status=active]:bg-sidebar-hover',
  'focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-sidebar-ink',
  'data-[status=active]:font-semibold data-[status=active]:text-white',
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
  const nav = useRef<HTMLElement>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { style, ready } = useSlidingHighlight(nav, activeNavPath(items, pathname) ?? '');
  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-sidebar">
      <div className="px-6 pt-7 pb-8">
        <Link
          to="/"
          viewTransition
          onClick={onNavigate}
          className="inline-block rounded-control focus-visible:outline-sidebar-ink"
        >
          <Logo />
        </Link>
      </div>
      {/* On a short screen the scene below gives way first, then the nav scrolls, so the foot stays in view. */}
      <nav
        ref={nav}
        aria-label="Main"
        className="scroll-area relative z-10 min-h-0 flex-initial overflow-y-auto px-3 py-0.5"
      >
        {/* The active item's background: it slides from the old item to the new one rather than jumping. */}
        <span
          aria-hidden
          className={cx(
            'pointer-events-none absolute top-0 left-0 -z-10 rounded-control bg-sidebar-active',
            ready && 'transition-[transform,width,height,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
          )}
          style={style}
        />
        {/* Admin items sit in small labelled groups (Money, Operations, People); the rest have no label. */}
        {navGroups(items).map((group, g) => (
          // Every group after the first sits below a hairline; a section's label is in Outfit and the brand sky blue,
          // so it reads as a heading rather than another item.
          <div key={group.section ?? `plain-${g}`} className={cx(g > 0 && 'mt-2.5 border-t border-white/12 pt-2.5')}>
            {group.section && (
              <p
                id={`nav-${group.section}`}
                className="px-3.5 pt-1.5 pb-1.5 font-section text-[15px] font-semibold tracking-[0.01em] text-sidebar-accent"
              >
                {group.section}
              </p>
            )}
            <ul aria-labelledby={group.section ? `nav-${group.section}` : undefined} className="flex flex-col gap-0.5">
              {group.items.map(({ to, label, icon: Icon, badge, exact }) => (
                <li key={to}>
                  <Link
                    to={to}
                    viewTransition
                    data-option={to}
                    onClick={onNavigate}
                    className={itemClass}
                    activeOptions={{ exact: exact ?? false }}
                  >
                    <Icon
                      aria-hidden
                      className="size-[18px] shrink-0 opacity-90 group-data-[status=active]:text-sidebar-accent group-data-[status=active]:opacity-100"
                      strokeWidth={1.75}
                    />
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
          </div>
        ))}
      </nav>

      {/* Decorative foot: a size container, so the scene and tagline appear only when there is real room below the
          nav (styles.css: .sidebar-foot). It never overlaps nav items, whatever the screen height or item count. */}
      <div
        aria-hidden
        className="sidebar-foot pointer-events-none relative mt-auto min-h-0 flex-1 basis-0 overflow-hidden"
      >
        <NavScene className="sidebar-scene absolute inset-x-0 bottom-0 h-[min(330px,100%)] w-full" />
        <p className="sidebar-tagline absolute inset-x-0 bottom-[296px] -rotate-3 px-6 text-center font-hand text-[1.75rem] leading-[1.15] text-sidebar-ink/90">
          Better stays.
          <br />
          Higher returns.
        </p>
      </div>

      {/* Foot: Help, Log out and the version, on the scene's darkest ground so the trees run into it. Always at the bottom;
          the scene above gives way first on short screens. */}
      <div className="relative z-10 flex-none bg-[#0a1827] px-3 pt-1 pb-4">
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
