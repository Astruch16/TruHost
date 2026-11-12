/**
 * Lake country (the Okanagan): golden hills, a lake with a dock and a little boat, vineyard rows on the near slope,
 * poplars and a modern house of wood and glass.
 */
export function LakeScene({ uid }: { uid: string }) {
  return (
    <g>
      <defs>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F4DFBC" />
          <stop offset="1" stopColor="#FBF6EC" />
        </linearGradient>
        <radialGradient id={`${uid}-shadow`}>
          <stop offset="0" stopColor="#101412" stopOpacity="0.25" />
          <stop offset="1" stopColor="#101412" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="320" height="180" fill={`url(#${uid}-sky)`} />
      <circle cx="96" cy="46" r="17" fill="#FFF1C9" />
      <circle cx="96" cy="46" r="26" fill="#FFF1C9" opacity="0.45" />
      {/* Golden hills */}
      <path d="M-10 108 C40 88 90 96 130 86 C180 74 230 90 330 82 V130 H-10 Z" fill="#DCC394" />
      <path d="M-10 120 C50 104 110 112 170 104 C230 96 280 108 330 102 V130 H-10 Z" fill="#C8A874" />
      <path d="M-10 120 C50 104 110 112 170 104 C150 112 80 112 -10 126 Z" fill="#FFFFFF" opacity="0.14" />
      {/* Lake, with the sun on the water */}
      <rect x="-10" y="118" width="340" height="26" fill="#8DB7C8" />
      <path
        d="M84 124 h24 M90 129 h12 M30 136 h18 M200 132 h22"
        stroke="#FFFFFF"
        strokeOpacity="0.65"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path d="M90 124 h12" stroke="#FFF1C9" strokeWidth="1.6" strokeLinecap="round" />
      {/* Dock and a little boat */}
      <path d="M40 140 L74 128 L78 130 L44 142 Z" fill="#8A6A4A" />
      <path d="M48 140 v5 M58 136 v5 M68 132 v5" stroke="#6E5238" strokeWidth="1.4" />
      <path d="M84 131 h14 l-3 3.5 h-8 Z" fill="#C4574A" />
      {/* Near slope with vineyard rows */}
      <path d="M-10 180 V140 C60 132 140 134 210 142 C262 148 300 152 330 152 V180 Z" fill="#A9B866" />
      <g fill="none" stroke="#7F9446" strokeWidth="2.2" strokeLinecap="round">
        <path d="M-6 148 C50 142 120 144 190 152" />
        <path d="M-6 156 C50 150 120 152 196 160" />
        <path d="M-6 164 C50 158 120 160 200 168" />
        <path d="M-6 172 C50 166 120 168 204 176" />
      </g>
      {/* Poplars around the house */}
      <g fill="#6E8B48">
        <ellipse cx="138" cy="118" rx="5" ry="16" />
        <ellipse cx="228" cy="122" rx="5" ry="16" />
        <ellipse cx="240" cy="126" rx="4.5" ry="13" />
        <ellipse cx="300" cy="130" rx="5" ry="15" />
      </g>
      <g fill="#FFFFFF" opacity="0.16">
        <ellipse cx="136" cy="114" rx="2" ry="9" />
        <ellipse cx="226" cy="118" rx="2" ry="9" />
      </g>
      <g transform="translate(-86 -11)">
        {/* Modern house: a glass box and a wood box, flat roofs, a deck */}
        <ellipse cx="262" cy="153" rx="38" ry="4.5" fill={`url(#${uid}-shadow)`} />
        <rect x="236" y="128" width="44" height="24" fill="#EFE8DA" />
        <rect x="241" y="133" width="34" height="14" fill="#9CC3D6" />
        <rect x="247" y="135" width="10" height="10" fill="#F2D987" />
        <path d="M258 133 v14 M266 133 v14" stroke="#EFE8DA" strokeWidth="1.2" />
        <rect x="232" y="125" width="52" height="3.5" rx="1" fill="#5B5148" />
        <rect x="276" y="136" width="22" height="16" fill="#B98A5E" />
        <path d="M276 140 h22 M276 144 h22 M276 148 h22" stroke="#9E714A" strokeWidth="1" />
        <rect x="274" y="133" width="26" height="3.5" rx="1" fill="#5B5148" />
        <rect x="230" y="151" width="70" height="3" rx="1" fill="#8A6A4A" />
      </g>
    </g>
  );
}
