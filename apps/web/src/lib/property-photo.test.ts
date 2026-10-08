import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '@truhost/api-client';
import { CARD_EDGE, fitWithin, LARGE_EDGE } from './property-photo';
import { sha256Hex, uploadBytes } from './upload';

describe('fitWithin', () => {
  it.each([
    // [width, height, max, expected]
    [4032, 3024, LARGE_EDGE, { width: 1600, height: 1200 }], // phone landscape
    [3024, 4032, LARGE_EDGE, { width: 1200, height: 1600 }], // phone portrait
    [4032, 3024, CARD_EDGE, { width: 640, height: 480 }],
    [1920, 1080, CARD_EDGE, { width: 640, height: 360 }],
    [800, 600, LARGE_EDGE, { width: 800, height: 600 }], // never enlarged
    [640, 640, CARD_EDGE, { width: 640, height: 640 }],
    [10000, 3, CARD_EDGE, { width: 640, height: 1 }], // never collapses to zero
  ])('%i×%i within %i → %o', (w, h, max, expected) => {
    expect(fitWithin(w, h, max)).toEqual(expected);
  });
});

describe('uploadBytes', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('declares type, size and hash, then PUTs exactly those bytes with the signed headers', async () => {
    const bytes = new TextEncoder().encode('jpeg bytes').buffer as ArrayBuffer;
    const post = vi.fn().mockResolvedValue({
      data: {
        fileId: 'f1',
        upload: { url: 'https://r2.test/put', method: 'PUT', headers: { 'Content-Type': 'image/jpeg' } },
      },
      response: new Response(null, { status: 201 }),
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const id = await uploadBytes(
      { POST: post } as unknown as ApiClient,
      { purpose: 'PROPERTY_PHOTO', propertyId: 'p1', contentType: 'image/jpeg', filename: null },
      bytes,
    );

    expect(id).toBe('f1');
    expect(post).toHaveBeenCalledWith('/v1/uploads', {
      body: {
        purpose: 'PROPERTY_PHOTO',
        propertyId: 'p1',
        contentType: 'image/jpeg',
        filename: null,
        sizeBytes: bytes.byteLength,
        sha256: await sha256Hex(bytes),
      },
    });
    expect(fetchMock).toHaveBeenCalledWith('https://r2.test/put', {
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg' },
      body: bytes,
    });
  });

  it('reports a failed PUT in words the user can act on', async () => {
    const post = vi.fn().mockResolvedValue({
      data: { fileId: 'f1', upload: { url: 'https://r2.test/put', method: 'PUT', headers: {} } },
      response: new Response(null, { status: 201 }),
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 403 })));
    await expect(
      uploadBytes(
        { POST: post } as unknown as ApiClient,
        { purpose: 'PROPERTY_PHOTO', propertyId: 'p1', contentType: 'image/jpeg', filename: null },
        new ArrayBuffer(1),
      ),
    ).rejects.toThrow('The upload failed. Please try again.');
  });
});
