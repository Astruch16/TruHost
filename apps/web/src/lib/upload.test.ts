import { describe, expect, it } from 'vitest';
import { sha256Hex } from './upload';

describe('sha256Hex', () => {
  it('matches the standard digest', async () => {
    const empty = await sha256Hex(new ArrayBuffer(0));
    expect(empty).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    const abc = await sha256Hex(new TextEncoder().encode('abc').buffer as ArrayBuffer);
    expect(abc).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
