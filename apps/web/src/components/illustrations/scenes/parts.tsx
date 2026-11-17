/**
 * Shared pieces of the property scenes, so they read as one illustrated set: curved pines (lit on one side), a row of
 * them along a ridge, a soft glow for lit windows and lamps, and a fine paper grain over the whole picture.
 */

/** A pine: a curved teardrop rather than a ruler triangle; `lit` paints its left side a shade lighter. */
export function Pine({
  x,
  y,
  h,
  fill,
  lit,
  snow,
}: {
  x: number;
  y: number;
  h: number;
  fill: string;
  lit?: string;
  snow?: string;
}) {
  const w = h * 0.42;
  return (
    <g>
      <path
        d={`M${x} ${y - h} Q${x + w * 0.22} ${y - h * 0.5} ${x + w / 2} ${y} Q${x} ${y + 1.5} ${x - w / 2} ${y} Q${x - w * 0.22} ${y - h * 0.5} ${x} ${y - h} Z`}
        fill={fill}
      />
      {lit && (
        <path
          d={`M${x} ${y - h} Q${x - w * 0.22} ${y - h * 0.5} ${x - w / 2} ${y} Q${x - w * 0.2} ${y + 0.5} ${x - w * 0.05} ${y} Q${x - w * 0.08} ${y - h * 0.5} ${x} ${y - h} Z`}
          fill={lit}
        />
      )}
      {snow && (
        <path
          d={`M${x} ${y - h} Q${x + w * 0.12} ${y - h * 0.78} ${x + w * 0.2} ${y - h * 0.62} Q${x + w * 0.05} ${y - h * 0.66} ${x} ${y - h * 0.6} Q${x - w * 0.06} ${y - h * 0.66} ${x - w * 0.2} ${y - h * 0.62} Q${x - w * 0.12} ${y - h * 0.78} ${x} ${y - h} Z M${x - w * 0.34} ${y - h * 0.3} Q${x} ${y - h * 0.4} ${x + w * 0.34} ${y - h * 0.3} Q${x} ${y - h * 0.26} ${x - w * 0.34} ${y - h * 0.3} Z`}
          fill={snow}
        />
      )}
    </g>
  );
}

/** A row of pines along a ridge (`base` gives the ground's height at x), spaced and sized by a fixed seed. */
export function PineRow({
  from,
  to,
  base,
  count,
  min,
  max,
  fill,
  snow,
  seed = 1,
}: {
  from: number;
  to: number;
  base: (x: number) => number;
  count: number;
  min: number;
  max: number;
  fill: string;
  snow?: string;
  seed?: number;
}) {
  // A fixed pseudo-random number in [0, 1) for each pine and draw, so the row looks scattered but never changes.
  const rand = (i: number, k: number) => {
    const v = Math.sin(seed * 127.1 + i * 311.7 + k * 74.7) * 43758.5453;
    return v - Math.floor(v);
  };
  const pines = Array.from({ length: count }, (_, i) => {
    const x = from + ((to - from) * (i + rand(i, 0) * 0.6)) / count;
    return { x, h: min + (max - min) * rand(i, 1) };
  });
  return (
    <g>
      {pines.map((p, i) => (
        <Pine key={i} x={p.x} y={base(p.x)} h={p.h} fill={fill} snow={snow} />
      ))}
    </g>
  );
}

/** A radial glow, for lit windows, lamps and the sun. */
export function GlowDef({ id, color, strength = 0.9 }: { id: string; color: string; strength?: number }) {
  return (
    <radialGradient id={id}>
      <stop offset="0" stopColor={color} stopOpacity={strength} />
      <stop offset="1" stopColor={color} stopOpacity="0" />
    </radialGradient>
  );
}

/** A soft shadow under a building or a tree. */
export function ShadowDef({ id, color = '#14231b' }: { id: string; color?: string }) {
  return (
    <radialGradient id={id}>
      <stop offset="0" stopColor={color} stopOpacity="0.35" />
      <stop offset="1" stopColor={color} stopOpacity="0" />
    </radialGradient>
  );
}

/** A fine paper grain over the whole picture, so it reads as printed rather than flat vector. */
export function Grain({ uid }: { uid: string }) {
  return (
    <>
      <defs>
        <filter id={`${uid}-grain`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncA type="table" tableValues="0 0.09" />
          </feComponentTransfer>
          <feComposite operator="in" in2="SourceGraphic" />
        </filter>
      </defs>
      <rect width="320" height="180" fill="#000" filter={`url(#${uid}-grain)`} />
    </>
  );
}
