import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { beginLoading, endLoading, SLOW_AFTER_MS, STUCK_AFTER_MS } from '../../lib/use-load-stage';
import { PortalLoading } from './portal-loading';

vi.mock('./mountain-scene', () => ({ MountainScene: () => null }));

describe('PortalLoading', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    endLoading(Number.NEGATIVE_INFINITY);
    delete document.documentElement.dataset.splash;
  });
  afterEach(() => vi.useRealTimers());

  it('says it is loading, then reassures, then offers to try again', () => {
    const onRetry = vi.fn();
    render(<PortalLoading onRetry={onRetry} />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Loading your portal…');
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();

    act(() => vi.advanceTimersByTime(SLOW_AFTER_MS + 10));
    expect(status).toHaveTextContent('Still loading. This can take a moment on a slower connection.');

    act(() => vi.advanceTimersByTime(STUCK_AFTER_MS - SLOW_AFTER_MS));
    expect(status).toHaveTextContent('This is taking longer than usual.');
    act(() => screen.getByRole('button', { name: 'Try again' }).click());
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('says so when the device is offline, and recovers when it is back', () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    render(<PortalLoading />);
    expect(screen.getByRole('status')).toHaveTextContent('You’re offline.');
    online.mockReturnValue(true);
    act(() => void window.dispatchEvent(new Event('online')));
    expect(screen.getByRole('status')).toHaveTextContent('Loading your portal…');
    online.mockRestore();
  });

  it('fades in quickly on its own, and without a fade when it continues another loading screen', () => {
    const { container, unmount } = render(<PortalLoading />);
    expect(container.firstElementChild).toHaveClass('animate-fade-in');
    unmount(); // e.g. Clerk is ready, now the account loads
    const next = render(<PortalLoading />);
    expect(next.container.firstElementChild).not.toHaveClass('animate-fade-in');
  });
});

describe('loading session', () => {
  beforeEach(() => {
    endLoading(Number.NEGATIVE_INFINITY);
    delete document.documentElement.dataset.splash;
  });

  it('starts fresh, continues straight after another screen, and starts fresh again later', () => {
    expect(beginLoading(1_000)).toEqual({ instant: false, since: 1_000 });
    endLoading(1_200);
    expect(beginLoading(1_300)).toEqual({ instant: true, since: 1_000 }); // same session
    endLoading(1_400);
    expect(beginLoading(5_000)).toEqual({ instant: false, since: 5_000 }); // a later, separate load
  });

  it('continues the first-paint screen from page load, once', () => {
    document.documentElement.dataset.splash = '1';
    expect(beginLoading(800)).toEqual({ instant: true, since: 0 });
    expect(document.documentElement.dataset.splash).toBeUndefined();
  });
});
