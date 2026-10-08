import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CoverImage } from './cover-image';

const setup = (url: string | null) => {
  const qc = new QueryClient();
  const invalidate = vi.spyOn(qc, 'invalidateQueries').mockResolvedValue();
  const view = render(
    <QueryClientProvider client={qc}>
      <CoverImage url={url} alt="Cover photo of Cedar Suite" fallback={<span>CS</span>} />
    </QueryClientProvider>,
  );
  return { invalidate, ...view, qc };
};

describe('CoverImage', () => {
  it('loads the photo lazily', () => {
    setup('https://r2.test/thumb?sig=1');
    const img = screen.getByRole('img', { name: 'Cover photo of Cedar Suite' });
    expect(img).toHaveAttribute('src', 'https://r2.test/thumb?sig=1');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('decoding', 'async');
  });

  it('shows the fallback without a photo', () => {
    setup(null);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('CS')).toBeInTheDocument();
  });

  it('falls back and fetches fresh links once when a link has expired', () => {
    const { invalidate, rerender, qc } = setup('https://r2.test/thumb?sig=old');
    fireEvent.error(screen.getByRole('img'));
    expect(screen.getByText('CS')).toBeInTheDocument();
    expect(invalidate.mock.calls.map(([f]) => f?.queryKey)).toEqual([['properties'], ['dashboard']]);

    // A fresh link shows the photo again; a second failure doesn't refetch forever.
    rerender(
      <QueryClientProvider client={qc}>
        <CoverImage url="https://r2.test/thumb?sig=new" alt="Cover photo of Cedar Suite" fallback={<span>CS</span>} />
      </QueryClientProvider>,
    );
    fireEvent.error(screen.getByRole('img'));
    expect(invalidate).toHaveBeenCalledTimes(2);
  });
});
