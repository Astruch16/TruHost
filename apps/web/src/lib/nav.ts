import type { LucideIcon } from 'lucide-react';
import {
  Building2,
  CalendarCheck,
  CalendarDays,
  CalendarOff,
  Camera,
  FileText,
  CalendarRange,
  Home,
  LayoutDashboard,
  Package,
  ReceiptText,
  ScrollText,
  Settings,
  Shield,
  TriangleAlert,
  Users,
} from 'lucide-react';
import type { LinkProps } from '@tanstack/react-router';

export interface NavItem {
  to: NonNullable<LinkProps['to']>;
  label: string;
  icon: LucideIcon;
  /** Count shown as a badge (e.g. items needing attention). */
  badge?: number;
  exact?: boolean;
  /** Also on the owner's bottom tab bar (phones). */
  tab?: boolean;
}

/** Owners (not staff) get the owner portal: its own pages, in the same shell. */
export const usesOwnerPortal = (me: { staffRole: string | null; memberships: { role: string }[] }) =>
  me.staffRole !== 'ADMIN' && me.memberships.some((m) => m.role === 'OWNER');

/**
 * Sidebar items for the signed-in user. Role-aware for convenience only; the API enforces access.
 * The owner dashboard sections from the mockup (Calendar, Cleans, …) are added as their phases land. Owners and
 * cleaners find supplies on each property's page.
 */
export function navItems(me: { staffRole: string | null; memberships: { role: string }[] }): NavItem[] {
  const items: NavItem[] = [];
  if (usesOwnerPortal(me)) {
    items.push(
      { to: '/owner', label: 'Home', icon: Home, exact: true, tab: true },
      { to: '/owner/calendar', label: 'Calendar', icon: CalendarRange, tab: true },
      { to: '/owner/statements', label: 'Statements', icon: FileText, tab: true },
      { to: '/owner/damage', label: 'Damage', icon: TriangleAlert, tab: true },
      { to: '/owner/care', label: 'Care', icon: Camera, tab: true },
    );
    // Someone who also cleans a property keeps their cleaning schedule.
    if (me.memberships.some((m) => m.role === 'CLEANER')) {
      items.push(
        { to: '/cleaner', label: 'Cleaning', icon: CalendarCheck, exact: true },
        { to: '/cleaner/time-off', label: 'Time off', icon: CalendarOff },
      );
    }
    items.push({ to: '/account', label: 'Settings', icon: Settings });
    return items;
  }
  if (me.staffRole === 'ADMIN') items.push({ to: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true });
  // Cleaners: their schedule first (it's their home page).
  if (me.memberships.some((m) => m.role === 'CLEANER')) {
    items.push(
      { to: '/cleaner', label: 'Schedule', icon: CalendarCheck, exact: true },
      { to: '/cleaner/time-off', label: 'Time off', icon: CalendarOff },
    );
  }
  if (me.memberships.length > 0) items.push({ to: '/properties', label: 'My properties', icon: Home });
  if (me.staffRole === 'ADMIN') {
    items.push(
      { to: '/admin/calendar', label: 'Calendar', icon: CalendarRange },
      { to: '/admin/properties', label: 'Properties', icon: Building2 },
      { to: '/admin/bookings', label: 'Bookings', icon: CalendarDays },
      { to: '/admin/expenses', label: 'Expenses', icon: ReceiptText },
      { to: '/admin/statements', label: 'Statements', icon: ScrollText },
      { to: '/admin/supplies', label: 'Supplies', icon: Package },
      { to: '/admin/damage', label: 'Damage', icon: TriangleAlert },
      { to: '/admin/team', label: 'Team', icon: Users },
      { to: '/admin/time-off', label: 'Time off', icon: CalendarOff },
      { to: '/admin/plans', label: 'Plans', icon: Shield },
    );
  }
  items.push({ to: '/account', label: 'Settings', icon: Settings });
  return items;
}

export function initials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || '?';
}

export function roleLabel(me: { staffRole: string | null; memberships: { role: string }[] }): string {
  if (me.staffRole === 'ADMIN') return 'Admin';
  if (me.memberships.some((m) => m.role === 'OWNER')) return 'Owner';
  if (me.memberships.some((m) => m.role === 'CLEANER')) return 'Cleaner';
  return 'Member';
}
