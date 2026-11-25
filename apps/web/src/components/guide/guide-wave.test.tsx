import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { GUIDES } from '../../lib/guides';
import { Guide } from './guide';
import { GuideWave } from './guide-wave';

const OWL_WAVE_SRC = GUIDES.sage.wave.video;
const OWL_STILL_SRC = GUIDES.sage.wave.still;

const label = /^Sage, a small green owl/;

afterEach(() => {
  delete document.documentElement.dataset.motion;
  vi.useRealTimers();
});

describe('GuideWave', () => {
  it('plays the 3D owl once: muted, autoplaying and inline, not looping', () => {
    const { container } = render(<GuideWave character="sage" size={120} />);
    expect(screen.getByRole('img', { name: label })).toBeInTheDocument();
    const video = container.querySelector('video')!;
    expect(video).toHaveAttribute('src', OWL_WAVE_SRC);
    expect(video.muted).toBe(true);
    expect(video).toHaveAttribute('autoplay');
    expect(video).toHaveAttribute('playsinline');
    expect(video).not.toHaveAttribute('loop');
    expect(video).toHaveAttribute('aria-hidden', 'true');
  });

  it('shows the 3D owl still instead when motion is reduced', () => {
    document.documentElement.dataset.motion = 'reduced';
    const { container } = render(<GuideWave character="sage" size={120} />);
    expect(container.querySelector('video')).toBeNull();
    expect(container.querySelector(`img[src="${OWL_STILL_SRC}"]`)).not.toBeNull();
    expect(screen.getByRole('img', { name: label })).toBeInTheDocument();
  });

  it('switches to the still owl when reduced motion is turned on while it shows', async () => {
    const { container } = render(<GuideWave character="sage" size={120} />);
    expect(container.querySelector('video')).not.toBeNull();
    await act(async () => {
      document.documentElement.dataset.motion = 'reduced';
      await Promise.resolve();
    });
    expect(container.querySelector('video')).toBeNull();
  });

  it('falls back to the still if the video fails, or is slow to arrive', () => {
    const failed = render(<GuideWave character="sage" size={120} />);
    fireEvent.error(failed.container.querySelector('video')!);
    expect(failed.container.querySelector(`img[src="${OWL_STILL_SRC}"]`)).not.toBeNull();
    failed.unmount();

    vi.useFakeTimers();
    const slow = render(<GuideWave character="sage" size={120} />);
    act(() => void vi.advanceTimersByTime(2600));
    expect(slow.container.querySelector('video')).toBeNull();
    expect(slow.container.querySelector(`img[src="${OWL_STILL_SRC}"]`)).not.toBeNull();
  });

  it('has a small decorative still for the picker button', () => {
    const { container } = render(<Guide character="sage" size={40} decorative />);
    expect(container.querySelector(`img[src="${OWL_STILL_SRC}"]`)).not.toBeNull();
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });

  it("plays Juniper's own animation, with Juniper's name, and falls back to Juniper's still", () => {
    const { container } = render(<GuideWave character="juniper" size={120} />);
    expect(screen.getByRole('img', { name: /^Juniper/ })).toBeInTheDocument();
    const video = container.querySelector('video')!;
    expect(video).toHaveAttribute('src', '/mascots/juniper-wave.webm');
    fireEvent.error(video);
    expect(container.querySelector('img[src="/mascots/juniper-wave-still.webp"]')).not.toBeNull();
  });

  it("plays Pip's (the chickadee's) own animation, with Pip's name, and falls back to Pip's still", () => {
    const { container } = render(<GuideWave character="pip" size={120} />);
    expect(screen.getByRole('img', { name: /^Pip/ })).toBeInTheDocument();
    const video = container.querySelector('video')!;
    expect(video).toHaveAttribute('src', '/mascots/chickadee-wave.webm');
    fireEvent.error(video);
    expect(container.querySelector('img[src="/mascots/chickadee-wave-still.webp"]')).not.toBeNull();
  });
});
