import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Property } from '@truhost/shared';
import { ApiContext } from '../lib/api-context';
import { CoverPhotoCard } from './cover-photo-card';

const property = { id: 'p1', name: 'Cedar Cabin', coverPhoto: null } as Property;

const show = (p: Property, sceneIndex: number | null) =>
  render(
    <ApiContext.Provider value={{} as never}>
      <QueryClientProvider client={new QueryClient()}>
        <CoverPhotoCard property={p} sceneIndex={sceneIndex} />
      </QueryClientProvider>
    </ApiContext.Provider>,
  );

describe('CoverPhotoCard', () => {
  it('shows the property’s illustrated scene until a photo is uploaded, and offers an upload', () => {
    const { container } = show(property, 2);
    expect(container.querySelector('svg[viewBox="0 0 320 180"]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'No cover photo yet. Upload one.' })).toBeTruthy();
    expect(screen.queryByText('CC')).toBeNull();
  });

  it('waits for the property list before choosing a scene, so it never swaps one for another', () => {
    const { container } = show(property, null);
    expect(container.querySelector('svg[viewBox="0 0 320 180"]')).toBeNull();
    expect(screen.getByRole('button', { name: 'No cover photo yet. Upload one.' })).toBeTruthy();
  });

  it('shows the photo once there is one', () => {
    const { container } = show(
      { ...property, coverPhoto: { id: 'ph', url: 'https://x/p.jpg', thumbUrl: 'https://x/t.jpg', expiresAt: '' } },
      2,
    );
    expect(screen.getByRole('img', { name: 'Cover photo of Cedar Cabin' })).toBeTruthy();
    expect(container.querySelector('svg[viewBox="0 0 320 180"]')).toBeNull();
  });
});
