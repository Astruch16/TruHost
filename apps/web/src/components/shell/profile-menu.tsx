import * as Menu from '@radix-ui/react-dropdown-menu';
import { Link } from '@tanstack/react-router';
import { KeyRound, LogOut, Settings } from 'lucide-react';
import { Avatar } from '../ui/avatar';
import { cx } from '../../lib/cx';
import { menuItemStyles, menuSurfaceStyles } from '../../lib/styles';

const itemClass = menuItemStyles;

export function ProfileMenu({
  name,
  initials,
  role,
  email,
  avatarUrl,
  onSignOut,
}: {
  name: string;
  initials: string;
  role: string;
  email: string;
  avatarUrl?: string | null;
  onSignOut: () => void;
}) {
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={`Account menu for ${name}`}
        className="flex min-h-11 items-center gap-3 rounded-full py-1 pr-1 pl-1 transition-colors hover:bg-ink/5 data-[state=open]:bg-ink/5 sm:pr-3"
      >
        <Avatar url={avatarUrl} initials={initials} className="size-10 text-sm" />
        <span className="hidden text-left leading-tight sm:block">
          <span className="block font-semibold text-ink">{name}</span>
          <span className="block text-xs text-muted">{role}</span>
        </span>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="end" sideOffset={8} className={cx(menuSurfaceStyles, 'min-w-56')}>
          <div className="flex items-center gap-3 px-2.5 py-2">
            <Avatar url={avatarUrl} initials={initials} className="size-9 text-xs" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">{name}</p>
              <p className="truncate text-xs text-muted">{email}</p>
            </div>
          </div>
          <Menu.Separator className="my-1 h-px bg-line-soft" />
          <Menu.Item asChild className={itemClass}>
            <Link to="/account">
              <Settings aria-hidden className="size-4 text-muted" /> Settings
            </Link>
          </Menu.Item>
          <Menu.Item asChild className={itemClass}>
            <Link to="/account/security">
              <KeyRound aria-hidden className="size-4 text-muted" /> Sign-in & security
            </Link>
          </Menu.Item>
          <Menu.Item className={itemClass} onSelect={onSignOut}>
            <LogOut aria-hidden className="size-4 text-muted" /> Log out
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
