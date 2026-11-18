import { afterEach, describe, expect, it } from 'vitest';
import { prefersReducedMotion } from './motion';

describe('prefersReducedMotion', () => {
  afterEach(() => delete document.documentElement.dataset.motion);

  it('follows "Reduce motion" in Settings', () => {
    document.documentElement.dataset.motion = 'reduced';
    expect(prefersReducedMotion()).toBe(true);
  });
});
