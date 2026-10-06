import * as Menu from '@radix-ui/react-dropdown-menu';
import { Link } from '@tanstack/react-router';
import { KeyRound, LogOut, Settings } from 'lucide-react';

const itemClass =
  'flex min-h-10 cursor-pointer items-center gap-2.5 rounded-control-sm px-2.5 text-sm text-ink outline-none transition-colors data-[highlighted]:bg-ground';

export function ProfileMenu({
  name,
  initials,
  role,
  email,
  onSignOut,
  onManageSignIn,
}: {
  name: string;
  initials: string;
  role: string;
  email: string;
  onSignOut: () => void;
  /** Opens the identity provider's own screen for email, password and sessions. */
  onManageSignIn: () => void;
}) {
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={`Account menu for ${name}`}
        className="flex min-h-11 items-center gap-3 rounded-full py-1 pr-1 pl-1 transition-colors hover:bg-ink/5 data-[state=open]:bg-ink/5 sm:pr-3"
      >
        <span className="grid size-10 place-items-center rounded-full bg-lavender-tint text-sm font-bold text-lavender-deep">
          {initials}
        </span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block font-semibold text-ink">{name}</span>
          <span className="block text-xs text-muted">{role}</span>
        </span>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          align="end"
          sideOffset={8}
          className="z-50 min-w-56 rounded-inner border border-line bg-surface p-1.5 shadow-xl animate-pop-in"
        >
          <div className="px-2.5 py-2">
            <p className="text-sm font-semibold text-ink">{name}</p>
            <p className="truncate text-xs text-muted">{email}</p>
          </div>
          <Menu.Separator className="my-1 h-px bg-line-soft" />
          <Menu.Item asChild className={itemClass}>
            <Link to="/account">
              <Settings aria-hidden className="size-4 text-muted" /> Settings
            </Link>
          </Menu.Item>
          <Menu.Item className={itemClass} onSelect={onManageSignIn}>
            <KeyRound aria-hidden className="size-4 text-muted" /> Sign-in & security
          </Menu.Item>
          <Menu.Item className={itemClass} onSelect={onSignOut}>
            <LogOut aria-hidden className="size-4 text-muted" /> Log out
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
