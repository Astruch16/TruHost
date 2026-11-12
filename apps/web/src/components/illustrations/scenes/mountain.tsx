/**
 * Mountains by a lake: the sign-in page's landscape by day. Snow on the high peaks, a lake, pines and a log cabin with
 * lit windows and a curl of smoke.
 */
export function MountainScene({ uid }: { uid: string }) {
  return (
    <g>
      <defs>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#CFE3D6" />
          <stop offset="1" stopColor="#F1F5EC" />
        </linearGradient>
        <radialGradient id={`${uid}-shadow`}>
          <stop offset="0" stopColor="#101412" stopOpacity="0.25" />
          <stop offset="1" stopColor="#101412" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="320" height="180" fill={`url(#${uid}-sky)`} />
      <circle cx="252" cy="38" r="16" fill="#F6E7B4" />
      <circle cx="252" cy="38" r="24" fill="#F6E7B4" opacity="0.35" />
      <path d="M58 40 q8 -10 18 -4 q6 -8 15 -2 q10 0 9 8 h-46 q-3 -4 4 -2 Z" fill="#FFFFFF" opacity="0.8" />
      <path
        d="M-10 112 L44 58 L78 86 L118 44 L162 92 L204 60 L248 98 L290 66 L330 104 L330 130 L-10 130 Z"
        fill="#A9C4B4"
      />
      <path d="M118 44 L104 58 L112 56 L118 62 L124 55 L132 58 Z" fill="#FFFFFF" opacity="0.9" />
      <path d="M44 58 L34 68 L41 66 L46 71 L51 66 Z" fill="#FFFFFF" opacity="0.85" />
      <path d="M204 60 L195 69 L202 67 L207 72 L212 68 Z" fill="#FFFFFF" opacity="0.85" />
      <path d="M-10 122 L60 82 L104 108 L150 78 L210 116 L262 90 L330 118 L330 140 L-10 140 Z" fill="#7FA592" />
      <path d="M60 82 L40 94 L60 92 L74 100 Z M150 78 L132 90 L150 88 L164 96 Z" fill="#FFFFFF" opacity="0.18" />
      <rect x="-10" y="128" width="340" height="16" fill="#BFD8CF" />
      <path
        d="M30 135 h18 M84 139 h14 M196 134 h20 M262 139 h16"
        stroke="#FFFFFF"
        strokeOpacity="0.7"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path d="M-10 142 C60 136 120 146 180 140 C240 134 290 142 330 138 L330 180 L-10 180 Z" fill="#5E8C6E" />
      <path d="M-10 154 C70 148 150 160 220 152 C270 147 300 152 330 150 L330 180 L-10 180 Z" fill="#4E7A5E" />
      <path d="M206 180 C204 168 196 160 184 156 L190 156 C204 160 214 168 218 180 Z" fill="#D8C9A3" opacity="0.85" />
      <ellipse cx="190" cy="157" rx="40" ry="5" fill={`url(#${uid}-shadow)`} />
      <rect x="162" y="128" width="56" height="28" rx="2" fill="#8A5A3B" />
      <path d="M162 135 h56 M162 142 h56 M162 149 h56" stroke="#6E4630" strokeWidth="1.2" />
      <path d="M156 130 L190 108 L224 130 Z" fill="#4A3427" />
      <path d="M156 130 L190 108 L190 112 L161 131 Z" fill="#5C4232" />
      <rect x="205" y="110" width="7" height="14" fill="#6B6F70" />
      <path
        d="M208 106 c-4 -5 4 -8 0 -13 c-3 -4 3 -7 1 -11"
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity="0.75"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <rect x="168" y="134" width="11" height="9" rx="1" fill="#F2D987" />
      <rect x="201" y="134" width="11" height="9" rx="1" fill="#F2D987" />
      <path d="M173.5 134 v9 M168 138.5 h11 M206.5 134 v9 M201 138.5 h11" stroke="#8A5A3B" strokeWidth="1" />
      <rect x="185" y="140" width="10" height="16" rx="1" fill="#4A3427" />
      <circle cx="193" cy="148.5" r="0.9" fill="#F2D987" />
      <g fill="#3F6B52">
        <path d="M120 150 L130 118 L140 150 Z" />
        <path d="M136 152 L144 126 L152 152 Z" />
        <path d="M244 150 L254 116 L264 150 Z" />
      </g>
      <g fill="#2F5541">
        <path d="M14 172 L30 112 L46 172 Z" />
        <path d="M40 176 L52 130 L64 176 Z" />
        <path d="M276 176 L292 118 L308 176 Z" />
        <path d="M300 180 L312 140 L324 180 Z" />
      </g>
      <g fill="#FFFFFF" opacity="0.14">
        <path d="M30 112 L18 160 L30 150 Z" />
        <path d="M292 118 L281 162 L292 152 Z" />
      </g>
    </g>
  );
}
