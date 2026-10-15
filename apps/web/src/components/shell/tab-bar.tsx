import { Link } from '@tanstack/react-router';
import type { NavItem } from '../../lib/nav';

/**
 * The owner's bottom tab bar on phones (below 768px), in place of the sidebar drawer: the same items as their
 * sidebar, in the sidebar's green, clear of the home indicator (safe-area padding).
 */
export function TabBar({ items }: { items: NavItem[] }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-sidebar pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="mx-auto grid max-w-lg" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map(({ to, label, icon: Icon, exact }) => (
          <li key={to}>
            <Link
              to={to}
              activeOptions={{ exact: exact ?? false }}
              className="group flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium text-sidebar-muted transition-colors focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-sidebar-ink data-[status=active]:text-white"
            >
              <span className="grid h-7 w-12 place-items-center rounded-full transition-colors group-data-[status=active]:bg-sidebar-active">
                <Icon aria-hidden className="size-5" />
              </span>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
