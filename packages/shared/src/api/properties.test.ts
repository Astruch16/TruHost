import { describe, expect, it } from 'vitest';
import { createProperty, updatePlan, updateProperty } from './properties.js';
import { updateMe } from './me.js';
import { updateUser } from './users.js';

describe('update schemas never inject defaults', () => {
  // In zod 4, `.partial()` keeps inner defaults; a PATCH must only carry what the client sent.
  it.each([
    ['updateProperty', updateProperty, { name: 'Renamed' }],
    ['updatePlan', updatePlan, { description: 'x' }],
    ['updateMe', updateMe, { phone: '1' }],
    ['updateUser', updateUser, { phone: '1' }],
  ] as const)('%s', (_, schema, input) => {
    expect(schema.parse(input)).toEqual(input);
  });
});

describe('createProperty', () => {
  it('applies BC defaults', () => {
    const p = createProperty.parse({ name: 'A', addressLine1: '1 St', city: 'Vancouver', postalCode: 'v6k 1a1' });
    expect(p).toMatchObject({
      province: 'BC',
      timeZone: 'America/Vancouver',
      checkInTime: '16:00',
      checkOutTime: '11:00',
      postalCode: 'V6K 1A1',
      defaultCleanerPayCents: 0,
    });
  });

  it('rejects unknown time zones and fractional cents', () => {
    const base = { name: 'A', addressLine1: '1 St', city: 'V', postalCode: 'V6K1A1' };
    expect(() => createProperty.parse({ ...base, timeZone: 'Mars/Base' })).toThrow();
    expect(() => createProperty.parse({ ...base, defaultCleanerPayCents: 1.5 })).toThrow();
  });
});
