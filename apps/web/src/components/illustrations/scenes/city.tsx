import { GlowDef } from './parts';

/** Window rows for a block: [x, y, width, height] of each lit or dark pane, from a fixed seed. */
function panes(x: number, y: number, w: number, h: number, seed: number) {
  let s = seed;
  const next = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  const out: { x: number; y: number; lit: boolean }[] = [];
  for (let row = y + 4; row < y + h - 4; row += 6) {
    for (let col = x + 3; col < x + w - 4; col += 5) out.push({ x: col, y: row, lit: next() > 0.55 });
  }
  return out;
}

const BLOCKS = [
  { x: 0, y: 108, w: 22, h: 40, fill: '#6E6492' },
  { x: 24, y: 96, w: 20, h: 52, fill: '#5E5585' },
  { x: 48, y: 88, w: 30, h: 60, fill: '#4E4775' },
  { x: 82, y: 104, w: 22, h: 44, fill: '#5E5585' },
  { x: 196, y: 94, w: 30, h: 54, fill: '#4E4775' },
  { x: 230, y: 108, w: 26, h: 40, fill: '#5E5585' },
  { x: 258, y: 98, w: 22, h: 50, fill: '#6E6492' },
  { x: 284, y: 90, w: 36, h: 58, fill: '#4E4775' },
];

/**
 * The city at dusk: an indigo sky warming to pink at the horizon, the first stars and a crescent moon, the North Shore
 * mountains behind the skyline, blocks with lit windows, and a glass condo tower in the middle with a beacon on top,
 * above the water (the lights reflected in it) and a park with glowing lamps.
 */
export function CityScene({ uid }: { uid: string }) {
  const u = (n: string) => `url(#${uid}-${n})`;
  const towerPanes = panes(140, 46, 34, 102, 11);
  return (
    <g>
      <defs>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#36406E" />
          <stop offset="0.55" stopColor="#9A7AA8" />
          <stop offset="1" stopColor="#F1B9B4" />
        </linearGradient>
        <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7A8FC0" />
          <stop offset="1" stopColor="#4E6296" />
        </linearGradient>
        <linearGradient id={`${uid}-water`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6A6898" />
          <stop offset="1" stopColor="#363C68" />
        </linearGradient>
        <GlowDef id={`${uid}-glow`} color="#FFD98A" />
        <GlowDef id={`${uid}-beacon`} color="#F07A86" />
      </defs>
      <rect width="320" height="180" fill={u('sky')} />
      {/* Stars and a crescent moon */}
      <g fill="#FFFFFF">
        <circle cx="40" cy="20" r="0.9" />
        <circle cx="96" cy="12" r="0.7" />
        <circle cx="210" cy="16" r="0.9" />
        <circle cx="262" cy="28" r="0.7" />
        <circle cx="300" cy="12" r="0.9" />
        <circle cx="128" cy="30" r="0.6" />
      </g>
      <path d="M252 46 a12 12 0 1 0 12 -14 a9 9 0 1 1 -12 14 Z" fill="#FFF3DC" />
      {/* North Shore mountains */}
      <path
        d="M-10 112 C20 98 40 80 64 74 C82 70 92 84 110 80 C130 76 146 62 168 60 C190 58 204 76 226 74 C250 72 270 64 292 70 C308 74 318 80 330 84 L330 130 L-10 130 Z"
        fill="#7C6E9A"
      />
      <path
        d="M160 63 C164 61 166 60 168 60 C172 61 176 63 180 66 C176 65 174 68 171 66 C168 68 166 65 163 67 Z"
        fill="#EBDCEB"
        opacity="0.8"
      />
      {/* Blocks, their windows partly lit */}
      {BLOCKS.map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} fill={b.fill} />
          {panes(b.x, b.y, b.w, b.h, i + 3).map((p, j) => (
            <rect
              key={j}
              x={p.x}
              y={p.y}
              width="2.6"
              height="2.6"
              rx="0.4"
              fill={p.lit ? '#FFD98A' : '#3E3866'}
              opacity={p.lit ? 0.95 : 0.6}
            />
          ))}
        </g>
      ))}
      {/* The condo tower: glass front, shaded side, balconies, lit windows, beacon */}
      <rect x="174" y="50" width="10" height="98" fill="#3E4D7E" />
      <rect x="138" y="54" width="38" height="94" fill={u('glass')} />
      <path d="M138 54 H176 L174 50 H144 Z" fill="#B7C4E6" />
      <path
        d="M138 64 H176 M138 74 H176 M138 84 H176 M138 94 H176 M138 104 H176 M138 114 H176 M138 124 H176 M138 134 H176"
        stroke="#FFFFFF"
        strokeOpacity="0.28"
        strokeWidth="1"
      />
      {towerPanes.map((p, j) =>
        p.lit ? <rect key={j} x={p.x} y={p.y} width="3.4" height="3" rx="0.4" fill="#FFE39E" /> : null,
      )}
      <path d="M138 54 L144 54 L144 148 L138 148 Z" fill="#FFFFFF" opacity="0.12" />
      <rect x="152" y="42" width="10" height="8" fill="#3E4D7E" />
      <path d="M157 42 V32" stroke="#3E4D7E" strokeWidth="1.4" />
      <circle cx="157" cy="31" r="5" fill={u('beacon')} />
      <circle cx="157" cy="31" r="1.4" fill="#F07A86" />
      {/* Water, with the lights in it */}
      <rect x="-10" y="148" width="340" height="12" fill={u('water')} />
      <path
        d="M150 150 v7 M160 151 v5 M168 150 v6 M60 151 v5 M66 150 v6 M210 151 v5 M290 150 v6"
        stroke="#FFD98A"
        strokeOpacity="0.7"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      {/* Seawall, park, round trees and glowing lamps */}
      <rect x="-10" y="158" width="340" height="2.5" fill="#B9A9B6" />
      <path d="M-10 160.5 H330 V180 H-10 Z" fill="#2E4A44" />
      <path d="M-10 172 C80 166 180 176 330 168 V180 H-10 Z" fill="#253E39" />
      <g fill="#3C5F55">
        <circle cx="30" cy="160" r="9" />
        <circle cx="98" cy="162" r="8" />
        <circle cx="222" cy="161" r="9" />
        <circle cx="290" cy="162" r="8" />
      </g>
      {[60, 130, 190, 256].map((x) => (
        <g key={x}>
          <path d={`M${x} 172 V161`} stroke="#1E302C" strokeWidth="1.2" />
          <circle cx={x} cy="160" r="6" fill={u('glow')} />
          <circle cx={x} cy="160" r="1.4" fill="#FFE39E" />
        </g>
      ))}
    </g>
  );
}
