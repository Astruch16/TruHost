import { describe, expect, it } from 'vitest';
import { cents } from './money.js';

describe('cents', () => {
  it('accepts integers', () => {
    expect(cents.parse(12345)).toBe(12345);
  });

  it('rejects fractional amounts', () => {
    expect(() => cents.parse(123.45)).toThrow();
  });
});
