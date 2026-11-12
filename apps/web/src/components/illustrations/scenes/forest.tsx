/**
 * In the snowy woods: an A-frame cabin with a tall lit window and a curl of smoke, snow on its roof, pines dusted with
 * snow, mountains behind and a few flakes falling.
 */
export function ForestScene({ uid }: { uid: string }) {
  return (
    <g>
      <defs>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#D2E1EC" />
          <stop offset="1" stopColor="#F4F8FB" />
        </linearGradient>
        <radialGradient id={`${uid}-shadow`}>
          <stop offset="0" stopColor="#1B2B3A" stopOpacity="0.22" />
          <stop offset="1" stopColor="#1B2B3A" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="320" height="180" fill={`url(#${uid}-sky)`} />
      <circle cx="248" cy="40" r="14" fill="#FBF3DA" />
      <circle cx="248" cy="40" r="22" fill="#FBF3DA" opacity="0.4" />
      {/* Snowy mountains */}
      <path d="M-10 118 L50 66 L96 100 L150 58 L204 102 L254 74 L330 112 V140 H-10 Z" fill="#B9CBDA" />
      <path
        d="M150 58 L134 72 L144 70 L150 76 L157 69 L166 72 Z M50 66 L38 76 L46 75 L51 80 L57 75 L62 77 Z M254 74 L244 82 L251 81 L255 85 L260 81 L266 83 Z"
        fill="#FFFFFF"
      />
      {/* A far line of pines */}
      <g fill="#8DA6A0">
        <path d="M0 132 L8 112 L16 132 Z M14 132 L22 116 L30 132 Z M60 132 L68 110 L76 132 Z M74 132 L82 116 L90 132 Z M240 132 L248 112 L256 132 Z M256 132 L264 116 L272 132 Z M300 132 L308 110 L316 132 Z" />
      </g>
      {/* Snow */}
      <path d="M-10 134 C80 124 200 130 330 122 V180 H-10 Z" fill="#F6F8FA" />
      <path
        d="M-10 150 C60 144 120 152 180 148 C240 144 290 150 330 146 V152 C290 156 240 150 180 156 C120 160 60 152 -10 158 Z"
        fill="#E1E9F0"
      />
      {/* A-frame: shadow, roof to the ground, snow on its edges, the tall lit window, a door, smoke */}
      <ellipse cx="166" cy="157" rx="46" ry="5" fill={`url(#${uid}-shadow)`} />
      <path
        d="M182 92 c-4 -5 4 -8 0 -13 c-3 -4 3 -7 1 -11"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <rect x="178" y="94" width="7" height="14" fill="#6B6F70" />
      <path d="M124 156 L166 88 L208 156 Z" fill="#5A3B2B" />
      <path d="M124 156 L166 88 L166 96 L131 156 Z" fill="#6E4A37" />
      <path
        d="M124 156 L166 88 L208 156"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="3.4"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path d="M142 156 L166 116 L190 156 Z" fill="#F2D987" />
      <path d="M166 116 V156 M154 136 H178 M148 146 H184" stroke="#5A3B2B" strokeWidth="1.6" />
      <rect x="160" y="142" width="12" height="14" fill="#4A3127" />
      <rect x="134" y="155" width="64" height="3" rx="1" fill="#8A6A4A" />
      {/* Pines dusted with snow */}
      <g fill="#2F5541">
        <path d="M18 170 L38 104 L58 170 Z" />
        <path d="M60 176 L74 128 L88 176 Z" />
        <path d="M248 172 L266 110 L284 172 Z" />
        <path d="M282 178 L298 126 L314 178 Z" />
      </g>
      <g fill="#FFFFFF">
        <path d="M38 104 L32 124 L38 120 L44 124 Z M74 128 L70 140 L74 138 L78 140 Z M266 110 L260 128 L266 124 L272 128 Z M298 126 L293 140 L298 137 L303 140 Z" />
        <path d="M27 140 L49 140 L46 134 Z M252 150 L280 150 L276 144 Z" opacity="0.85" />
      </g>
      {/* A few flakes */}
      <g fill="#FFFFFF">
        <circle cx="100" cy="40" r="1.6" />
        <circle cx="132" cy="62" r="1.3" />
        <circle cx="210" cy="50" r="1.5" />
        <circle cx="290" cy="70" r="1.3" />
        <circle cx="60" cy="58" r="1.2" />
      </g>
    </g>
  );
}
