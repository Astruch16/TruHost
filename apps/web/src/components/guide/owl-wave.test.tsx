import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { OWL_WAVE_SRC, OwlWave } from './owl-wave';

const label = /^Sage, a small green owl/;

afterEach(() => {
  delete document.documentElement.dataset.motion;
  vi.useRealTimers();
});

describe('OwlWave', () => {
  it('plays the 3D owl once: muted, autoplaying and inline, not looping', () => {
    const { container } = render(<OwlWave size={120} />);
    expect(screen.getByRole('img', { name: label })).toBeInTheDocument();
    const video = container.querySelector('video')!;
    expect(video).toHaveAttribute('src', OWL_WAVE_SRC);
    expect(video.muted).toBe(true);
    expect(video).toHaveAttribute('autoplay');
    expect(video).toHaveAttribute('playsinline');
    expect(video).not.toHaveAttribute('loop');
    expect(video).toHaveAttribute('aria-hidden', 'true');
  });

  it('shows the still owl instead when motion is reduced', () => {
    document.documentElement.dataset.motion = 'reduced';
    const { container } = render(<OwlWave size={120} />);
    expect(container.querySelector('video')).toBeNull();
    expect(container.querySelector('svg[data-guide="sage"]')).not.toBeNull();
    expect(screen.getByRole('img', { name: label })).toBeInTheDocument();
  });

  it('switches to the still owl when reduced motion is turned on while it shows', async () => {
    const { container } = render(<OwlWave size={120} />);
    expect(container.querySelector('video')).not.toBeNull();
    await act(async () => {
      document.documentElement.dataset.motion = 'reduced';
      await Promise.resolve();
    });
    expect(container.querySelector('video')).toBeNull();
  });

  it('falls back to the still owl if the video fails, or is slow to arrive', () => {
    const failed = render(<OwlWave size={120} />);
    fireEvent.error(failed.container.querySelector('video')!);
    expect(failed.container.querySelector('svg[data-guide="sage"]')).not.toBeNull();
    failed.unmount();

    vi.useFakeTimers();
    const slow = render(<OwlWave size={120} />);
    act(() => void vi.advanceTimersByTime(2600));
    expect(slow.container.querySelector('video')).toBeNull();
    expect(slow.container.querySelector('svg[data-guide="sage"]')).not.toBeNull();
  });
});
