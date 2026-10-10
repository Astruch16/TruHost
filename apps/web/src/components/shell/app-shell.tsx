import { useState, type ReactNode } from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { Menu, X } from 'lucide-react';
import type { NavItem } from '../../lib/nav';
import { ShellContext } from '../../lib/shell-context';
import { FEATURES } from '../../lib/features';
import { NotificationsBell } from './notifications-bell';
import { ProfileMenu } from './profile-menu';
import { PropertySwitcher, type SwitcherProperty } from './property-switcher';
import { Sidebar } from './sidebar';

export interface ShellUser {
  name: string;
  initials: string;
  role: string;
  email: string;
  avatarUrl?: string | null;
}

/**
 * Presentational app frame: fixed sidebar on desktop, slide-in menu on phones, top bar with property switcher,
 * notifications and profile. Takes data as props so it can be previewed without the API.
 */
export function AppShell({
  nav,
  user,
  properties,
  selectedPropertyId,
  onSelectProperty,
  allowAllProperties = false,
  unreadNotifications = 0,
  onSignOut,
  children,
}: {
  nav: NavItem[];
  user: ShellUser;
  properties: SwitcherProperty[];
  selectedPropertyId: string | null;
  onSelectProperty: (id: string | null) => void;
  /** Offer "All properties" in the switcher (admins). */
  allowAllProperties?: boolean;
  unreadNotifications?: number;
  onSignOut: () => void;
  children: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-ground lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <a
        href="#main"
        className="sr-only z-50 rounded-control bg-surface px-4 py-2 font-semibold focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>

      <aside className="sticky top-0 hidden h-dvh lg:block">
        <Sidebar items={nav} onSignOut={onSignOut} />
      </aside>

      <RadixDialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
        <RadixDialog.Portal>
          <RadixDialog.Overlay className="fixed inset-0 z-40 bg-ink/40 animate-fade-in lg:hidden" />
          <RadixDialog.Content
            aria-describedby={undefined}
            className="fixed inset-y-0 left-0 z-50 w-[min(18rem,85vw)] animate-slide-in focus:outline-none lg:hidden"
          >
            <RadixDialog.Title className="sr-only">Menu</RadixDialog.Title>
            <Sidebar items={nav} onSignOut={onSignOut} onNavigate={() => setMenuOpen(false)} />
            <RadixDialog.Close
              aria-label="Close menu"
              className="absolute top-4 right-3 z-20 grid size-10 place-items-center rounded-full text-sidebar-ink hover:bg-sidebar-hover"
            >
              <X aria-hidden className="size-5" />
            </RadixDialog.Close>
          </RadixDialog.Content>
        </RadixDialog.Portal>
      </RadixDialog.Root>

      {/* The content area is a container: pages lay out against its width, not the viewport's, because the
          sidebar takes a fixed share of the screen. */}
      <div className="@container/content flex min-w-0 flex-col">
        <header className="mx-auto flex w-full max-w-[1680px] items-center gap-2 px-4 pt-4 @2xl/content:px-8 @2xl/content:pt-6 @[100rem]/content:px-10">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMenuOpen(true)}
            className="grid size-11 shrink-0 place-items-center rounded-full text-ink transition-colors hover:bg-ink/5 lg:hidden"
          >
            <Menu aria-hidden className="size-5" />
          </button>
          <div className="min-w-0 flex-1">
            {properties.length > 0 && (
              <PropertySwitcher
                properties={properties}
                selectedId={selectedPropertyId}
                onSelect={onSelectProperty}
                allowAll={allowAllProperties}
              />
            )}
          </div>
          {/* Hidden until notifications are sent (lib/features.ts). */}
          {FEATURES.notifications && <NotificationsBell unread={unreadNotifications} />}
          <ProfileMenu {...user} onSignOut={onSignOut} />
        </header>
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-[1680px] flex-1 px-4 py-6 focus:outline-none @2xl/content:px-8 @2xl/content:py-8 @[100rem]/content:px-10"
        >
          <ShellContext.Provider value={true}>{children}</ShellContext.Provider>
        </main>
      </div>
    </div>
  );
}
