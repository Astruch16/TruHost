import { describe, expect, it } from 'vitest';
import { activeNavPath } from './nav';

const ADMIN = [
  { to: '/admin', exact: true },
  { to: '/admin/calendar' },
  { to: '/admin/bookings' },
  { to: '/admin/properties' },
  { to: '/account' },
] as const;

describe('activeNavPath', () => {
  it('picks the page itself, including the exact Dashboard', () => {
    expect(activeNavPath(ADMIN, '/admin')).toBe('/admin');
    expect(activeNavPath(ADMIN, '/admin/bookings')).toBe('/admin/bookings');
    expect(activeNavPath(ADMIN, '/admin/bookings/')).toBe('/admin/bookings');
  });

  it("picks a sub-page's parent, never the exact Dashboard", () => {
    expect(activeNavPath(ADMIN, '/admin/properties/p1')).toBe('/admin/properties');
    expect(activeNavPath(ADMIN, '/admin/statements')).toBeNull();
  });

  it("doesn't match a path that only shares a prefix", () => {
    expect(activeNavPath(ADMIN, '/admin/calendarish')).toBeNull();
    expect(activeNavPath(ADMIN, '/accounting')).toBeNull();
  });
});
