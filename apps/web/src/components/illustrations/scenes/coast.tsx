/**
 * On the coast: a white cottage on a grassy bluff over the sea, a lighthouse on the rocks, a sailboat, gulls and a
 * strip of beach.
 */
export function CoastScene({ uid }: { uid: string }) {
  return (
    <g>
      <defs>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#BFDDEE" />
          <stop offset="1" stopColor="#F1F7FA" />
        </linearGradient>
        <linearGradient id={`${uid}-sea`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#86B8D3" />
          <stop offset="1" stopColor="#4F87AC" />
        </linearGradient>
        <radialGradient id={`${uid}-shadow`}>
          <stop offset="0" stopColor="#101412" stopOpacity="0.25" />
          <stop offset="1" stopColor="#101412" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="320" height="180" fill={`url(#${uid}-sky)`} />
      {/* Sun, a cloud and gulls */}
      <circle cx="74" cy="40" r="15" fill="#FBEFC7" />
      <circle cx="74" cy="40" r="23" fill="#FBEFC7" opacity="0.35" />
      <path d="M206 36 q8 -10 18 -4 q6 -8 15 -2 q10 0 9 8 h-46 q-3 -4 4 -2 Z" fill="#FFFFFF" opacity="0.85" />
      <path
        d="M226 54 q4 -4 8 0 q4 -4 8 0 M250 66 q3 -3 6 0 q3 -3 6 0"
        fill="none"
        stroke="#5F7686"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      {/* A far island, then the sea */}
      <path d="M196 104 C212 92 236 90 252 98 C268 92 286 96 298 104 Z" fill="#A3BCCD" />
      <rect x="-10" y="103" width="340" height="77" fill={`url(#${uid}-sea)`} />
      <path
        d="M24 114 h22 M96 122 h28 M58 136 h18 M176 116 h24"
        stroke="#FFFFFF"
        strokeOpacity="0.6"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      {/* Sailboat */}
      <g transform="translate(-30 0)">
        <path d="M100 119 h24 l-4 5 h-16 Z" fill="#46647A" />
        <path d="M112 118 V94 L126 117 Z" fill="#FFFFFF" />
        <path d="M111 118 V99 L101 117 Z" fill="#E4ECF1" />
      </g>
      {/* Lighthouse on the rocks */}
      <path d="M4 160 C10 146 36 140 56 148 L62 164 Z" fill="#8F8470" />
      <path d="M4 160 C10 150 24 146 36 146 L30 162 Z" fill="#A79B84" />
      <path d="M26 148 L30 108 H42 L46 148 Z" fill="#F7F5F0" />
      <path d="M28.6 128 H43.4 L44.2 136 H27.8 Z M29.8 114 H42.2 L42.8 120 H29.2 Z" fill="#C4574A" />
      <rect x="30" y="100" width="12" height="9" rx="1.5" fill="#F2D987" />
      <path d="M28 101 L36 94 L44 101 Z" fill="#46647A" />
      {/* Beach and foam */}
      <path d="M-10 180 C30 166 80 160 140 170 L150 180 Z" fill="#EAD9B2" />
      <path d="M-10 168 C30 158 80 152 140 162" fill="none" stroke="#FFFFFF" strokeOpacity="0.75" strokeWidth="2" />
      <g transform="translate(-78 0)">
        {/* The bluff: a rock face at the water, grass on top */}
        <path d="M150 180 C152 164 160 152 172 144 C182 158 192 170 202 180 Z" fill="#B5A68B" />
        <path d="M150 180 C152 170 156 162 162 156 L168 180 Z" fill="#9C8E74" />
        <path d="M170 145 C198 130 252 124 420 126 V180 H202 C192 170 182 158 170 145 Z" fill="#6FA27F" />
        <path d="M170 145 C198 130 252 124 420 126 V131 C262 130 210 134 176 150 Z" fill="#FFFFFF" opacity="0.14" />
        {/* Cottage: shadow, white walls, slate roof, chimney, lit windows, door */}
        <ellipse cx="252" cy="131" rx="34" ry="4.5" fill={`url(#${uid}-shadow)`} />
        <rect x="264" y="88" width="7" height="14" fill="#7C8381" />
        <rect x="228" y="106" width="48" height="25" rx="1.5" fill="#F4F1EA" />
        <path d="M220 108 L252 86 L284 108 Z" fill="#46647A" />
        <path d="M220 108 L252 86 L252 90 L226 109 Z" fill="#FFFFFF" opacity="0.16" />
        <rect x="234" y="113" width="9" height="8" rx="1" fill="#F2D987" />
        <rect x="261" y="113" width="9" height="8" rx="1" fill="#F2D987" />
        <path d="M238.5 113 v8 M234 117 h9 M265.5 113 v8 M261 117 h9" stroke="#C9C2B0" strokeWidth="0.9" />
        <rect x="248" y="116" width="8" height="15" rx="1" fill="#46647A" />
        {/* Pines on the bluff */}
        <g fill="#3F6B52">
          <path d="M290 132 L300 100 L310 132 Z" />
          <path d="M304 136 L314 108 L324 136 Z" />
        </g>
        <path d="M300 100 L292 128 L300 122 Z" fill="#FFFFFF" opacity="0.14" />
      </g>
    </g>
  );
}
