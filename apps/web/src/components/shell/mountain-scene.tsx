import { useMemo } from 'react';
import { buildScene, SCENE_HEIGHT, SCENE_WIDTH } from '../../lib/scene';

/**
 * Layered mountains and pines. Decorative only. `width` is the design width in scene units; the SVG scales to its
 * box, cropping the sides (never the peaks) when the box is narrower than that ratio.
 */
export function MountainScene({ width = SCENE_WIDTH, className }: { width?: number; className?: string }) {
  const scene = useMemo(() => buildScene(width), [width]);
  const id = `th-scene-${width}`;
  return (
    <svg
      aria-hidden
      focusable="false"
      viewBox={`0 0 ${width} ${SCENE_HEIGHT}`}
      preserveAspectRatio="xMidYMax slice"
      className={className}
    >
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#173f3a" stopOpacity="0" />
          <stop offset="0.45" stopColor="#2b524b" />
          <stop offset="1" stopColor="#36605a" />
        </linearGradient>
        <linearGradient id={`${id}-mist`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.6" stopColor="#ffffff" stopOpacity="0.1" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width={width} height={SCENE_HEIGHT} fill={`url(#${id}-sky)`} />
      <path d={scene.backRange} fill="#5a7a73" />
      {scene.backSnow.map((d) => (
        <path key={d} d={d} fill="#8aa59e" />
      ))}
      <path d={scene.midRange} fill="#426860" />
      <rect y="196" width={width} height="50" fill={`url(#${id}-mist)`} />
      <path d={scene.farPines} fill="#2f554e" />
      <path d={scene.hill} fill="#1f433d" />
      <path d={scene.midPines} fill="#183a34" />
      <path d={scene.ground} fill="#122d29" />
      <path d={scene.frontPines} fill="#0e2421" />
      <rect y="318" width={width} height="12" fill="#0e2421" />
    </svg>
  );
}
