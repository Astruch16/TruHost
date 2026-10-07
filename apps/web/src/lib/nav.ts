import type { LucideIcon } from 'lucide-react';
import {
  Building2,
  CalendarDays,
  CalendarRange,
  Home,
  LayoutDashboard,
  ReceiptText,
  Settings,
  Shield,
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
}

/**
 * Sidebar items for the signed-in user. Role-aware for convenience only; the API enforces access.
 * The owner dashboard sections from the mockup (Calendar, Cleans, Supplies, …) are added as their phases land.
 */
export function navItems(me: { staffRole: string | null; memberships: unknown[] }): NavItem[] {
  const items: NavItem[] = [];
  if (me.staffRole === 'ADMIN') items.push({ to: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true });
  if (me.memberships.length > 0) items.push({ to: '/properties', label: 'My properties', icon: Home });
  if (me.staffRole === 'ADMIN') {
    items.push(
      { to: '/admin/calendar', label: 'Calendar', icon: CalendarRange },
      { to: '/admin/properties', label: 'Properties', icon: Building2 },
      { to: '/admin/bookings', label: 'Bookings', icon: CalendarDays },
      { to: '/admin/expenses', label: 'Expenses', icon: ReceiptText },
      { to: '/admin/team', label: 'Team', icon: Users },
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
