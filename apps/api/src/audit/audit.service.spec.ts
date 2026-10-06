import { changedFields } from './audit.service.js';

describe('changedFields', () => {
  it('keeps only fields whose values changed', () => {
    expect(changedFields({ a: 1, b: 'x', c: null }, { a: 1, b: 'y', c: 'z' })).toEqual({
      before: { b: 'x', c: null },
      after: { b: 'y', c: 'z' },
    });
  });

  it('returns null for a no-op update', () => {
    expect(changedFields({ a: 1 }, { a: 1 })).toBeNull();
  });

  it('ignores updatedAt and compares dates by value', () => {
    const d = new Date('2026-01-01T00:00:00Z');
    expect(changedFields({ when: d, updatedAt: 1 }, { when: new Date(d), updatedAt: 2 })).toBeNull();
  });
});
