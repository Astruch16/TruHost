import { GlowDef, Pine, PineRow, ShadowDef } from './parts';

const ridge = (x: number) => 110 - 8 * Math.sin(x / 38) - 4 * Math.cos(x / 17);

/**
 * Mountains at golden hour: dusty-lavender peaks with snow that follows the slope, a forested ridge, a lake catching
 * the low sun with a canoe on it, and a log cabin with glowing windows, a porch light and a curl of smoke, framed by
 * pines.
 */
export function MountainScene({ uid }: { uid: string }) {
  const u = (n: string) => `url(#${uid}-${n})`;
  return (
    <g>
      <defs>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F2C6A6" />
          <stop offset="1" stopColor="#FBEBD3" />
        </linearGradient>
        <linearGradient id={`${uid}-far`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#C7AEC2" />
          <stop offset="1" stopColor="#E3CFDB" />
        </linearGradient>
        <linearGradient id={`${uid}-lake`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F1D6BC" />
          <stop offset="1" stopColor="#8DB0AD" />
        </linearGradient>
        <GlowDef id={`${uid}-glow`} color="#FFD98A" />
        <ShadowDef id={`${uid}-shadow`} />
      </defs>
      <rect width="320" height="180" fill={u('sky')} />
      {/* The low sun, clouds and two birds */}
      <circle cx="246" cy="58" r="30" fill="#FFE7B8" opacity="0.45" />
      <circle cx="246" cy="58" r="20" fill="#FFF4D9" />
      <path
        d="M30 44 C34 36 46 36 50 42 C54 34 68 35 70 44 C78 44 80 50 74 52 L32 52 C24 52 24 45 30 44 Z"
        fill="#FFF6EA"
        opacity="0.9"
      />
      <path
        d="M150 30 C152 26 158 26 160 29 C163 25 170 26 171 31 C175 31 176 35 172 36 L152 36 C147 36 147 31 150 30 Z"
        fill="#FFF6EA"
        opacity="0.7"
      />
      <path
        d="M118 46 q3 -3 6 0 q3 -3 6 0 M134 54 q2 -2 4 0 q2 -2 4 0"
        fill="none"
        stroke="#4D4446"
        strokeWidth="1.1"
        strokeLinecap="round"
        opacity="0.6"
      />
      {/* Far range, rounded peaks, snow following the slope */}
      <path
        d="M-10 112 C10 104 26 76 46 66 C54 62 60 66 66 72 C78 86 92 62 110 46 C120 38 128 42 136 50 C150 64 166 84 186 76 C202 70 214 52 232 46 C244 42 254 52 264 60 C280 72 300 64 330 74 L330 130 L-10 130 Z"
        fill={u('far')}
      />
      <path
        d="M100 56 C104 51 107 48 110 46 C115 49 120 53 125 57 C121 56 119 60 116 57 C113 60 111 56 108 59 C105 56 103 58 100 56 Z M38 72 C41 69 44 67 46 66 C50 68 54 70 57 73 C54 72 52 75 50 73 C48 75 45 72 43 74 C41 72 40 73 38 72 Z M222 53 C226 49 229 47 232 46 C236 48 240 51 244 54 C240 53 238 57 235 54 C232 57 230 53 227 56 C225 53 224 55 222 53 Z"
        fill="#FFF7EE"
      />
      {/* Hills and a forested ridge */}
      <path
        d="M-10 122 C30 106 62 100 94 104 C126 108 146 94 176 92 C206 90 226 102 256 100 C284 98 304 92 330 96 L330 134 L-10 134 Z"
        fill="#93A69A"
      />
      <PineRow from={-6} to={330} base={ridge} count={34} min={9} max={16} fill="#577763" seed={7} />
      <path d="M-10 118 C40 112 90 120 140 116 C190 112 240 120 330 112 L330 134 L-10 134 Z" fill="#6B8A77" />
      {/* Lake: the sun's reflection and a canoe */}
      <path d="M-10 128 C60 126 140 130 200 128 C250 126 300 129 330 127 L330 152 L-10 152 Z" fill={u('lake')} />
      <path
        d="M232 134 h28 M238 139 h18 M242 144 h10 M60 138 h22 M30 145 h14"
        stroke="#FFFFFF"
        strokeOpacity="0.7"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path d="M72 140 q12 5 26 0 q-2 3 -13 3 q-11 0 -13 -3 Z" fill="#A8473D" />
      <path d="M84 140 l2 -6" stroke="#5A3A2A" strokeWidth="1" strokeLinecap="round" />
      {/* Shore */}
      <path d="M-10 150 C40 140 92 147 142 144 C192 141 244 149 330 140 L330 180 L-10 180 Z" fill="#4F7A5E" />
      {/* Cabin: shadow, smoke, chimney, log walls, deep roof, glowing windows, arched door, porch light */}
      <ellipse cx="176" cy="157" rx="44" ry="5" fill={u('shadow')} />
      <path
        d="M186 104 c-5 -6 5 -10 0 -16 c-4 -5 4 -9 1 -14"
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity="0.8"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <rect x="182" y="106" width="8" height="16" rx="1" fill="#6B6264" />
      <path d="M148 132 L148 156 L204 156 L204 132 Z" fill="#A9643F" />
      <path d="M148 139 H204 M148 146 H204 M148 152 H204" stroke="#8A4E31" strokeWidth="1.2" />
      <path d="M141 134 C150 126 164 114 176 106 C188 114 202 126 211 134 C206 135 146 135 141 134 Z" fill="#3B2A2C" />
      <path d="M141 134 C150 126 164 114 176 106 L176 111 C165 118 154 127 147 134 Z" fill="#FFFFFF" opacity="0.12" />
      <circle cx="160" cy="143" r="11" fill={u('glow')} />
      <circle cx="192" cy="143" r="11" fill={u('glow')} />
      <rect x="154" y="138" width="12" height="10" rx="1.5" fill="#FFD98A" />
      <rect x="186" y="138" width="12" height="10" rx="1.5" fill="#FFD98A" />
      <path d="M160 138 v10 M154 143 h12 M192 138 v10 M186 143 h12" stroke="#8A4E31" strokeWidth="1" />
      <path d="M170 156 V143 a6 6 0 0 1 12 0 V156 Z" fill="#3B2A2C" />
      <circle cx="179" cy="150" r="0.9" fill="#FFD98A" />
      <circle cx="186" cy="139" r="4" fill={u('glow')} />
      {/* Winding path, near grass, tufts */}
      <path
        d="M176 156 C172 162 162 166 160 172 C158 177 166 180 168 182 L186 182 C180 178 174 175 176 170 C178 165 186 161 182 156 Z"
        fill="#E2CFA6"
      />
      <path
        d="M-10 164 C40 156 92 168 150 162 C210 156 262 166 330 158 L330 180 L-10 180 Z"
        fill="#3C6550"
        opacity="0.9"
      />
      <path
        d="M120 166 q2 -6 4 0 q2 -5 4 0 M228 164 q2 -6 4 0 q2 -5 4 0 M60 170 q2 -5 4 0"
        fill="none"
        stroke="#294A3B"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      {/* Framing pines */}
      <Pine x={24} y={176} h={74} fill="#294A3B" lit="#3F6A54" />
      <Pine x={48} y={180} h={52} fill="#294A3B" lit="#3F6A54" />
      <Pine x={298} y={178} h={80} fill="#294A3B" lit="#3F6A54" />
      <Pine x={276} y={180} h={46} fill="#294A3B" lit="#3F6A54" />
    </g>
  );
}
