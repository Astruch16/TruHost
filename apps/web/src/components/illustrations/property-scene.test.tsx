import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { PropertyScene } from './property-scene';

/** The scene's drawing, without its per-instance gradient ids. */
const drawing = (index: number) => {
  const { container, unmount } = render(<PropertyScene index={index} />);
  const markup = container.innerHTML.replace(/ps[^"#)]*-/g, 'ps-');
  unmount();
  return markup;
};

describe('property scene', () => {
  it('gives the first five properties five different scenes, then starts over', () => {
    const scenes = [0, 1, 2, 3, 4].map(drawing);
    expect(new Set(scenes).size).toBe(5);
    expect(drawing(5)).toBe(scenes[0]);
  });

  it('is decorative and fills its box without stretching', () => {
    const { container } = render(<PropertyScene index={2} className="size-full" />);
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('preserveAspectRatio', 'xMidYMax slice');
  });
});
