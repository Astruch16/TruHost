import { GlowDef, Pine, ShadowDef } from './parts';

/**
 * The coast at sunset: the sun half into the sea with its path of light, a far headland, a sailboat, a lighthouse on a
 * rocky islet sending out a soft beam, gulls, and a white cottage with glowing windows on a grassy bluff above a strip
 * of beach.
 */
export function CoastScene({ uid }: { uid: string }) {
  const u = (n: string) => `url(#${uid}-${n})`;
  return (
    <g>
      <defs>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#D9A9BF" />
          <stop offset="0.55" stopColor="#F4C9B9" />
          <stop offset="1" stopColor="#FCE6D2" />
        </linearGradient>
        <linearGradient id={`${uid}-sea`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#C7A6C0" />
          <stop offset="0.45" stopColor="#8A97B8" />
          <stop offset="1" stopColor="#5B7FA2" />
        </linearGradient>
        <linearGradient id={`${uid}-beam`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFF3D6" stopOpacity="0.8" />
          <stop offset="1" stopColor="#FFF3D6" stopOpacity="0" />
        </linearGradient>
        <GlowDef id={`${uid}-glow`} color="#FFD98A" />
        <GlowDef id={`${uid}-sun`} color="#FFE9C4" strength={0.7} />
        <ShadowDef id={`${uid}-shadow`} />
      </defs>
      <rect width="320" height="180" fill={u('sky')} />
      {/* Sun setting into the sea, a long low cloud, gulls */}
      <circle cx="104" cy="104" r="46" fill={u('sun')} />
      <path d="M82 104 a22 22 0 0 1 44 0 Z" fill="#FFF3DC" />
      <path
        d="M150 62 C170 56 196 58 214 62 C232 58 252 60 262 66 C240 68 200 68 150 66 Z"
        fill="#FBDCD0"
        opacity="0.8"
      />
      <path
        d="M200 40 q4 -4 8 0 q4 -4 8 0 M222 50 q3 -3 6 0 q3 -3 6 0 M180 52 q2.5 -2.5 5 0 q2.5 -2.5 5 0"
        fill="none"
        stroke="#5B4B5A"
        strokeWidth="1.1"
        strokeLinecap="round"
        opacity="0.65"
      />
      {/* Far headland on the horizon */}
      <path d="M190 104 C206 96 226 94 244 98 C262 92 288 94 330 100 L330 104 Z" fill="#9C8AA8" />
      {/* Sea, with the sun's path of light */}
      <rect x="-10" y="104" width="340" height="76" fill={u('sea')} />
      <path
        d="M86 108 h36 M90 113 h28 M95 119 h20 M99 126 h12 M101 133 h8"
        stroke="#FFF1D6"
        strokeOpacity="0.85"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M30 120 h16 M150 116 h14 M168 128 h18 M40 136 h12"
        stroke="#FFFFFF"
        strokeOpacity="0.45"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      {/* Sailboat */}
      <path d="M132 121 h18 l-3 4 h-12 Z" fill="#4A4560" />
      <path d="M141 120 V101 L152 119 Z" fill="#FBEFE6" />
      <path d="M140 120 V105 L132 119 Z" fill="#E8D8DD" />
      <path d="M134 127 h14 M137 130 h8" stroke="#FFFFFF" strokeOpacity="0.45" strokeWidth="1" strokeLinecap="round" />
      {/* Lighthouse on its islet, with a beam */}
      <path d="M40 92 L120 70 L120 98 Z" fill={u('beam')} />
      <path d="M8 150 C14 136 40 130 62 138 L68 154 Z" fill="#6F6476" />
      <path d="M8 150 C14 140 28 136 40 136 L34 152 Z" fill="#857A8B" />
      <path d="M30 140 L33 98 H45 L48 140 Z" fill="#F7F1EA" />
      <path d="M31.6 120 H46.4 L47 128 H31 Z M32.6 105 H45.4 L45.8 111 H32.2 Z" fill="#B9505A" />
      <circle cx="39" cy="92" r="9" fill={u('glow')} />
      <rect x="34" y="89" width="10" height="9" rx="1.5" fill="#FFE39E" />
      <path d="M32 90 L39 83 L46 90 Z" fill="#3E3A50" />
      {/* Beach and foam */}
      <path d="M-10 180 C30 166 80 160 140 168 L150 180 Z" fill="#EFD9C0" />
      <path d="M-10 168 C30 158 80 152 140 160" fill="none" stroke="#FFFFFF" strokeOpacity="0.8" strokeWidth="2" />
      {/* Bluff: rock at the water, grass on top */}
      <path d="M118 180 C120 160 130 146 146 138 C158 154 170 168 182 180 Z" fill="#9A8576" />
      <path d="M118 180 C120 168 126 158 134 152 L142 180 Z" fill="#7F6B60" />
      <path d="M144 139 C176 124 236 118 340 120 V180 H182 C170 168 158 154 144 139 Z" fill="#5E8466" />
      <path d="M144 139 C176 124 236 118 340 120 V126 C262 124 196 128 150 145 Z" fill="#9DBF86" opacity="0.55" />
      {/* Cottage: shadow, white walls, slate roof, chimney, glowing windows, porch light */}
      <ellipse cx="192" cy="131" rx="38" ry="4.5" fill={u('shadow')} />
      <path
        d="M211 84 c-4 -5 4 -8 0 -13 c-3 -4 3 -7 1 -11"
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity="0.75"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <rect x="206" y="86" width="7" height="14" rx="1" fill="#7A7486" />
      <rect x="168" y="106" width="48" height="25" rx="1.5" fill="#F6EFE6" />
      <path d="M160 108 C170 100 182 92 192 86 C202 92 214 100 224 108 C214 109 170 109 160 108 Z" fill="#4C5A70" />
      <path d="M160 108 C170 100 182 92 192 86 L192 90 C182 96 172 102 166 108 Z" fill="#FFFFFF" opacity="0.15" />
      <circle cx="178" cy="117" r="9" fill={u('glow')} />
      <circle cx="206" cy="117" r="9" fill={u('glow')} />
      <rect x="173" y="113" width="10" height="8" rx="1" fill="#FFD98A" />
      <rect x="201" y="113" width="10" height="8" rx="1" fill="#FFD98A" />
      <path d="M178 113 v8 M173 117 h10 M206 113 v8 M201 117 h10" stroke="#C9BFB4" strokeWidth="0.9" />
      <path d="M188 131 V120 a4 4 0 0 1 8 0 V131 Z" fill="#4C5A70" />
      <circle cx="199" cy="118" r="3.5" fill={u('glow')} />
      {/* Picket fence and wildflowers */}
      <path
        d="M226 132 v-6 M230 132 v-6 M234 132 v-6 M238 132 v-6 M242 132 v-6 M224 128 h20"
        stroke="#F6EFE6"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <g fill="#E7A1B5">
        <circle cx="158" cy="148" r="1.4" />
        <circle cx="166" cy="152" r="1.2" />
        <circle cx="236" cy="144" r="1.4" />
        <circle cx="252" cy="150" r="1.2" />
        <circle cx="270" cy="140" r="1.4" />
      </g>
      {/* Windswept pines on the bluff */}
      <Pine x={262} y={132} h={34} fill="#355D48" lit="#4A7A5E" />
      <Pine x={282} y={136} h={44} fill="#2C4E3D" lit="#416E55" />
      <Pine x={304} y={140} h={56} fill="#2C4E3D" lit="#416E55" />
    </g>
  );
}
