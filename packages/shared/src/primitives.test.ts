import { describe, expect, it } from 'vitest';
import { email, monthStart } from './primitives.js';

describe('email', () => {
  it('trims and lower-cases before validating', () => {
    expect(email.parse('  Jo.Smith@Example.COM ')).toBe('jo.smith@example.com');
  });
  it('rejects non-emails', () => {
    expect(() => email.parse('nope')).toThrow();
  });
});

describe('monthStart', () => {
  it('accepts only the first of a month', () => {
    expect(monthStart.parse('2026-11-01')).toBe('2026-11-01');
    expect(() => monthStart.parse('2026-11-02')).toThrow();
  });
});
