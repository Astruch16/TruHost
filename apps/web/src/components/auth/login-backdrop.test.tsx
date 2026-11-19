import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { LOGIN_STILL } from '../../lib/login-backdrop';
import { LoginBackdrop } from './login-backdrop';

let play: ReturnType<typeof vi.spyOn>;
let pause: ReturnType<typeof vi.spyOn>;
let hidden = false;

beforeEach(() => {
  hidden = false;
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
  play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
});

afterEach(() => {
  delete document.documentElement.dataset.motion;
  vi.restoreAllMocks();
});

function setHidden(value: boolean) {
  hidden = value;
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

describe('LoginBackdrop', () => {
  it('loops the campfire video full screen: muted, autoplaying, inline, with the still as its poster', () => {
    const { container } = render(<LoginBackdrop />);
    const video = container.querySelector('video')!;
    expect(video).toHaveAttribute('poster', LOGIN_STILL);
    expect(video.muted).toBe(true);
    expect(video.defaultMuted).toBe(true);
    expect(video).toHaveAttribute('autoplay');
    expect(video).toHaveAttribute('loop');
    expect(video).toHaveAttribute('playsinline');
    expect(video).toHaveClass('object-cover');
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('plays the one H.264 MP4, with no other sources', () => {
    const { container } = render(<LoginBackdrop />);
    expect(container.querySelector('video')).toHaveAttribute('src', '/login/login-loop.mp4');
    expect(container.querySelectorAll('video > source')).toHaveLength(0);
  });

  it('frames the guides on portrait screens', () => {
    const { container } = render(<LoginBackdrop />);
    expect(container.querySelector('video')).toHaveClass('object-[17%_50%]', 'landscape:object-center');
  });

  it('pauses while the tab is hidden and plays again when it comes back', () => {
    const { container } = render(<LoginBackdrop />);
    const video = container.querySelector('video')!;
    setHidden(true);
    expect(pause).toHaveBeenCalledTimes(1);
    expect(pause.mock.instances[0]).toBe(video);
    setHidden(false);
    expect(play).toHaveBeenCalledTimes(1);
    expect(play.mock.instances[0]).toBe(video);
  });

  it('starts paused when the page opens in a background tab', () => {
    hidden = true;
    render(<LoginBackdrop />);
    expect(pause).toHaveBeenCalled();
  });

  it('stops listening once it is gone', () => {
    const { unmount } = render(<LoginBackdrop />);
    unmount();
    setHidden(true);
    expect(pause).not.toHaveBeenCalled();
  });

  it('shows only the still when motion is reduced', () => {
    document.documentElement.dataset.motion = 'reduced';
    const { container } = render(<LoginBackdrop />);
    expect(container.querySelector('video')).toBeNull();
    expect(container.querySelector('img')).toHaveAttribute('src', LOGIN_STILL);
  });

  it('becomes a band along the bottom when given a portrait framing', () => {
    const { container } = render(<LoginBackdrop framing={{ height: 480, objectX: 5.8 }} />);
    const band = container.firstElementChild as HTMLElement;
    expect(band.style.height).toBe('480px');
    expect(band.style.top).toBe('auto');
    expect(container.querySelector('video')!.style.objectPosition).toBe('5.8% 50%');
  });
});
