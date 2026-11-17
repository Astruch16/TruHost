import { GlowDef, Pine, PineRow, ShadowDef } from './parts';

/**
 * The snowy woods at blue hour: a violet sky fading to pink at the horizon, the first stars and a moon, snow-capped
 * mountains, a line of snow-dusted pines, and an A-frame whose big lit window throws warm light across the snow.
 */
export function ForestScene({ uid }: { uid: string }) {
  const u = (n: string) => `url(#${uid}-${n})`;
  const treeLine = (x: number) => 128 - 3 * Math.sin(x / 24) - 2 * Math.cos(x / 11);
  return (
    <g>
      <defs>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2F3D63" />
          <stop offset="0.55" stopColor="#8D86B4" />
          <stop offset="1" stopColor="#E8B9C2" />
        </linearGradient>
        <linearGradient id={`${uid}-peaks`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8C90BC" />
          <stop offset="1" stopColor="#B4A9CA" />
        </linearGradient>
        <linearGradient id={`${uid}-snow`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#D9DCEE" />
          <stop offset="1" stopColor="#F1F2F9" />
        </linearGradient>
        <linearGradient id={`${uid}-spill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFD98A" stopOpacity="0.45" />
          <stop offset="1" stopColor="#FFD98A" stopOpacity="0" />
        </linearGradient>
        <GlowDef id={`${uid}-moon`} color="#FFF6E2" strength={0.5} />
        <GlowDef id={`${uid}-glow`} color="#FFD98A" />
        <ShadowDef id={`${uid}-shadow`} color="#2A2F52" />
      </defs>
      <rect width="320" height="180" fill={u('sky')} />
      {/* Stars and a moon */}
      <g fill="#FFFFFF">
        {[
          [24, 18, 0.9],
          [62, 34, 0.6],
          [98, 12, 0.8],
          [140, 28, 0.6],
          [186, 14, 0.9],
          [212, 40, 0.5],
          [296, 22, 0.8],
          [36, 52, 0.5],
          [122, 50, 0.4],
        ].map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} opacity={0.85} />
        ))}
      </g>
      <circle cx="258" cy="38" r="26" fill={u('moon')} />
      <circle cx="258" cy="38" r="10" fill="#FFF6E2" />
      <circle cx="263" cy="35" r="9" fill="#5A5C8C" opacity="0.18" />
      {/* Mountains with soft snow caps */}
      <path
        d="M-10 118 C20 100 40 74 60 70 C80 74 92 96 112 92 C132 80 146 58 162 56 C180 60 196 88 214 92 C232 86 246 74 262 76 C284 82 306 100 330 106 V140 H-10 Z"
        fill={u('peaks')}
      />
      <path
        d="M60 70 C50 76 46 82 42 88 C50 84 56 88 62 84 C66 88 72 84 76 86 C72 78 66 72 60 70 Z M162 56 C152 62 146 70 142 78 C150 74 156 78 162 74 C168 79 174 74 182 77 C176 66 170 58 162 56 Z M262 76 C254 80 250 84 246 90 C254 86 258 90 264 86 C268 90 272 87 278 89 C274 82 268 77 262 76 Z"
        fill="#F4F1FA"
      />
      {/* Far pine line with snow */}
      <path
        d={`M-10 140 V${treeLine(0)} ${Array.from({ length: 35 }, (_, i) => `L${i * 10} ${treeLine(i * 10)}`).join(' ')} L330 ${treeLine(330)} V140 Z`}
        fill="#4C5E7E"
      />
      <PineRow from={-6} to={326} base={treeLine} count={26} min={12} max={22} fill="#4C5E7E" snow="#E3E4F2" seed={7} />
      {/* Snowfield with pink drifts */}
      <path d="M-10 180 V136 C60 128 130 134 200 130 C250 128 300 132 330 130 V180 Z" fill={u('snow')} />
      <path
        d="M-10 160 C40 152 100 158 140 156 C110 162 50 162 -10 168 Z M220 162 C260 154 300 156 330 152 V160 C300 162 260 164 220 162 Z"
        fill="#F3DCE4"
        opacity="0.8"
      />
      {/* Warm light spilling from the window across the snow */}
      <path d="M156 151 C148 160 138 170 126 182 H210 C198 170 188 160 180 151 Z" fill={u('spill')} />
      <ellipse cx="168" cy="158" rx="30" ry="8" fill={u('glow')} opacity="0.45" />
      {/* A-frame: shadow, body, lit window, snowy roof edges, chimney and smoke */}
      <ellipse cx="168" cy="153" rx="44" ry="5" fill={u('shadow')} />
      <path
        d="M187 92 c-4 -5 4 -8 0 -13 c-3 -4 3 -7 1 -11"
        fill="none"
        stroke="#EDE8F4"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.55"
      />
      <rect x="182" y="96" width="7" height="14" fill="#3B2A2C" />
      <path d="M168 88 L132 152 H204 Z" fill="#4A3428" />
      <circle cx="168" cy="128" r="26" fill={u('glow')} />
      <path d="M168 104 L150 140 H186 Z" fill="#FFD98A" />
      <path d="M168 104 V140 M159 122 H177" stroke="#6E4C38" strokeWidth="1.3" />
      <rect x="161" y="140" width="14" height="12" rx="1.5" fill="#3B2A2C" />
      <path d="M168 86 L128 154 L134 154 L168 94 L202 154 L208 154 Z" fill="#F4F2FA" />
      <path d="M181 96 h9 v3 h-9 Z" fill="#F4F2FA" />
      {/* Framing snow pines */}
      <Pine x={22} y={168} h={64} fill="#2E3A5C" lit="#43517A" snow="#EEF0F8" />
      <Pine x={52} y={174} h={44} fill="#2E3A5C" lit="#43517A" snow="#EEF0F8" />
      <Pine x={292} y={170} h={70} fill="#2E3A5C" lit="#43517A" snow="#EEF0F8" />
      <Pine x={262} y={176} h={40} fill="#2E3A5C" lit="#43517A" snow="#EEF0F8" />
      {/* Falling flakes */}
      <g fill="#FFFFFF" opacity="0.8">
        {[
          [40, 70],
          [84, 108],
          [118, 74],
          [206, 64],
          [230, 112],
          [276, 96],
          [146, 40],
          [310, 60],
          [10, 100],
          [104, 140],
          [236, 140],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 1.4 : 1} />
        ))}
      </g>
    </g>
  );
}
