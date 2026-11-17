import { GlowDef, ShadowDef } from './parts';

/**
 * Lake country (the Okanagan) in the late-afternoon warmth: a big low sun, golden rolling hills, a lake with a dock and
 * a little boat, vineyard rows curving over the near slope, tall poplars, and a modern house of wood and glass with
 * its windows lit.
 */
export function LakeScene({ uid }: { uid: string }) {
  const u = (n: string) => `url(#${uid}-${n})`;
  return (
    <g>
      <defs>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#EFC9C2" />
          <stop offset="1" stopColor="#FBEFDD" />
        </linearGradient>
        <linearGradient id={`${uid}-lake`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E9D3C6" />
          <stop offset="1" stopColor="#7FA6B6" />
        </linearGradient>
        <linearGradient id={`${uid}-slope`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#B9BE74" />
          <stop offset="1" stopColor="#8E9A55" />
        </linearGradient>
        <GlowDef id={`${uid}-sun`} color="#FFEBC6" strength={0.75} />
        <GlowDef id={`${uid}-glow`} color="#FFD98A" />
        <ShadowDef id={`${uid}-shadow`} />
      </defs>
      <rect width="320" height="180" fill={u('sky')} />
      {/* Big low sun, a thin cloud, birds */}
      <circle cx="78" cy="62" r="40" fill={u('sun')} />
      <circle cx="78" cy="62" r="20" fill="#FFF5DE" />
      <path
        d="M190 40 C210 34 236 36 252 40 C266 37 282 39 290 44 C270 46 230 46 190 44 Z"
        fill="#FFF3E6"
        opacity="0.8"
      />
      <path
        d="M150 50 q3 -3 6 0 q3 -3 6 0 M168 58 q2 -2 4 0 q2 -2 4 0"
        fill="none"
        stroke="#6A5550"
        strokeWidth="1.1"
        strokeLinecap="round"
        opacity="0.6"
      />
      {/* Golden hills, far then near, lit along their tops */}
      <path d="M-10 100 C30 84 70 90 110 82 C150 74 190 90 230 82 C270 74 300 80 330 78 V116 H-10 Z" fill="#D9BC9A" />
      <path d="M-10 108 C40 96 100 104 160 96 C220 88 270 100 330 94 V116 H-10 Z" fill="#C6A27C" />
      <path d="M-10 108 C40 96 100 104 160 96 C120 104 60 104 -10 114 Z" fill="#FFFFFF" opacity="0.14" />
      <path d="M-10 112 C60 108 140 112 200 109 C250 107 300 110 330 108 V116 H-10 Z" fill="#B48F6C" />
      {/* Lake, with the sun's path on the water */}
      <rect x="-10" y="110" width="340" height="60" fill={u('lake')} />
      <path
        d="M58 118 h40 M64 123 h28 M70 128 h18 M74 133 h10 M196 116 h22 M252 114 h16"
        stroke="#FFFFFF"
        strokeOpacity="0.7"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      {/* Little boat */}
      <path d="M106 136 q9 4 20 0 q-2 3.5 -10 3.5 q-8 0 -10 -3.5 Z" fill="#B94E57" />
      <path d="M108 141 h16" stroke="#FFFFFF" strokeOpacity="0.4" strokeWidth="1" strokeLinecap="round" />
      {/* Near shore rising to the right, a strip of sand at the water */}
      <path
        d="M-10 180 V158 C40 154 90 146 130 136 C170 126 220 120 262 121 C292 122 312 124 330 124 V180 Z"
        fill="#E8D6B4"
      />
      <path
        d="M-10 180 V161 C40 157 90 150 130 140 C170 130 220 124 262 125 C292 126 312 128 330 128 V180 Z"
        fill={u('slope')}
      />
      {/* Dock reaching into the lake */}
      <path d="M50 158 L84 140 L89 142 L55 160 Z" fill="#8A6A4A" />
      <path d="M60 156 v6 M72 150 v6 M84 144 v5" stroke="#6E5238" strokeWidth="1.4" />
      {/* Vineyard rows following the slope */}
      <g fill="none" stroke="#6F8240" strokeWidth="2.2" strokeLinecap="round">
        <path d="M96 162 C150 150 220 140 330 138" />
        <path d="M84 170 C150 158 220 148 330 146" />
        <path d="M70 178 C150 166 220 156 330 154" />
        <path d="M70 186 C150 174 220 164 330 162" />
      </g>
      <g fill="#5E6E36">
        {[
          [140, 152],
          [190, 144.5],
          [250, 140],
          [300, 138.5],
          [140, 160],
          [190, 152.5],
          [250, 148],
          [300, 146.5],
          [190, 160.5],
          [250, 156],
          [300, 154.5],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="1.1" />
        ))}
      </g>
      {/* Poplars, lit on one side, with soft shadows */}
      {[
        [138, 138, 19],
        [232, 126, 19],
        [245, 128, 15],
        [302, 127, 18],
      ].map(([x, y, h], i) => (
        <g key={i}>
          <ellipse cx={x! + 4} cy={y} rx="7" ry="1.6" fill={u('shadow')} />
          <ellipse cx={x} cy={y! - h! / 2 - 2} rx="5" ry={h} fill="#5F7B3E" />
          <ellipse cx={x! - 1.8} cy={y! - h! / 2 - 4} rx="2" ry={h! * 0.7} fill="#89A55C" opacity="0.6" />
        </g>
      ))}
      {/* Modern house on the shore: shadow, glass box with lit rooms, wood box, flat roofs, deck */}
      <ellipse cx="186" cy="131" rx="42" ry="4.5" fill={u('shadow')} />
      <rect x="156" y="104" width="44" height="25" fill="#F1E9DC" />
      <circle cx="174" cy="116" r="18" fill={u('glow')} />
      <rect x="161" y="109" width="34" height="15" fill="#FFE4A3" />
      <path d="M170 109 v15 M179 109 v15 M188 109 v15" stroke="#E6D8C3" strokeWidth="1.1" />
      <rect x="152" y="101" width="52" height="3.5" rx="1" fill="#4F453E" />
      <rect x="198" y="113" width="24" height="16" fill="#9B6A4A" />
      <path d="M198 117 h24 M198 121 h24 M198 125 h24" stroke="#7E5438" strokeWidth="1" />
      <rect x="207" y="117" width="7" height="12" fill="#3F3530" />
      <rect x="196" y="110" width="28" height="3.5" rx="1" fill="#4F453E" />
      <rect x="150" y="128" width="76" height="3" rx="1" fill="#8A6A4A" />
      <path d="M154 131 v4 M222 131 v3" stroke="#6E5238" strokeWidth="1.2" />
    </g>
  );
}
