/**
 * In the city: a glass condo tower among the downtown blocks at dusk, the North Shore mountains behind, the water and
 * a strip of park with trees in front. Some windows are lit.
 */
export function CityScene({ uid }: { uid: string }) {
  const lit = '#F2D987';
  return (
    <g>
      <defs>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#D5CDEE" />
          <stop offset="1" stopColor="#F8EEF0" />
        </linearGradient>
        <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7E9DC2" />
          <stop offset="1" stopColor="#6383AA" />
        </linearGradient>
      </defs>
      <rect width="320" height="180" fill={`url(#${uid}-sky)`} />
      <circle cx="252" cy="92" r="17" fill="#FBE3C2" />
      <circle cx="252" cy="92" r="26" fill="#FBE3C2" opacity="0.35" />
      {/* North Shore mountains */}
      <path d="M-10 116 L40 84 L84 104 L132 72 L182 100 L232 78 L282 102 L330 88 V140 H-10 Z" fill="#CBC2E5" />
      <path
        d="M132 72 L122 80 L130 79 L134 84 L140 79 Z M40 84 L33 89 L39 88 L42 92 L47 88 Z"
        fill="#FFFFFF"
        opacity="0.8"
      />
      {/* Far blocks */}
      <g fill="#B4AAD2">
        <rect x="0" y="106" width="22" height="40" />
        <rect x="26" y="96" width="18" height="50" />
        <rect x="216" y="102" width="20" height="44" />
        <rect x="276" y="104" width="22" height="42" />
        <rect x="300" y="94" width="22" height="52" />
      </g>
      {/* Mid blocks with window rows */}
      <g fill="#8E86BA">
        <rect x="48" y="90" width="30" height="56" rx="1" />
        <rect x="180" y="98" width="30" height="48" rx="1" />
        <rect x="238" y="112" width="34" height="34" rx="1" />
        <rect x="6" y="118" width="30" height="28" rx="1" />
      </g>
      <g fill="#A79FCF">
        <path d="M52 96 h22 v2 h-22 Z M52 104 h22 v2 h-22 Z M52 112 h22 v2 h-22 Z M52 120 h22 v2 h-22 Z M52 128 h22 v2 h-22 Z" />
        <path d="M184 104 h22 v2 h-22 Z M184 112 h22 v2 h-22 Z M184 120 h22 v2 h-22 Z M184 128 h22 v2 h-22 Z" />
        <path d="M242 118 h26 v2 h-26 Z M242 126 h26 v2 h-26 Z M242 134 h26 v2 h-26 Z" />
      </g>
      <g fill={lit}>
        <rect x="58" y="103.5" width="5" height="3" />
        <rect x="66" y="119.5" width="5" height="3" />
        <rect x="190" y="111.5" width="5" height="3" />
        <rect x="250" y="125.5" width="5" height="3" />
      </g>
      {/* The condo tower: glass front, a shaded side, balcony lines, a few lit windows */}
      <rect x="146" y="44" width="10" height="102" fill="#4E6B90" />
      <rect x="114" y="48" width="34" height="98" fill={`url(#${uid}-glass)`} />
      <path d="M114 48 H148 L146 44 H120 Z" fill="#A8BEDA" />
      <rect x="126" y="38" width="10" height="8" fill="#4E6B90" />
      <path d="M131 38 V30" stroke="#4E6B90" strokeWidth="1.4" />
      <g stroke="#FFFFFF" strokeOpacity="0.45" strokeWidth="1.2">
        <path d="M114 58 H148 M114 68 H148 M114 78 H148 M114 88 H148 M114 98 H148 M114 108 H148 M114 118 H148 M114 128 H148" />
      </g>
      <path d="M131 48 V146" stroke="#FFFFFF" strokeOpacity="0.2" strokeWidth="1" />
      <g fill={lit}>
        <rect x="118" y="60" width="9" height="6" />
        <rect x="135" y="80" width="9" height="6" />
        <rect x="118" y="100" width="9" height="6" />
        <rect x="135" y="120" width="9" height="6" />
        <rect x="118" y="130" width="9" height="6" />
      </g>
      <path d="M114 48 L120 48 L120 146 L114 146 Z" fill="#FFFFFF" opacity="0.12" />
      {/* Water, seawall, park and trees */}
      <rect x="-10" y="145" width="340" height="12" fill="#A6BADA" />
      <path
        d="M120 149 v6 M140 149 v5 M60 151 h14 M220 150 h18"
        stroke="#FFFFFF"
        strokeOpacity="0.55"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <rect x="-10" y="156" width="340" height="3" fill="#CFC8BC" />
      <rect x="-10" y="159" width="340" height="21" fill="#6FA27F" />
      <path d="M-10 172 C80 166 180 176 330 168 V180 H-10 Z" fill="#5E8C6E" />
      <g fill="#4E8460">
        <circle cx="34" cy="158" r="9" />
        <circle cx="96" cy="160" r="8" />
        <circle cx="206" cy="159" r="9" />
        <circle cx="282" cy="160" r="8" />
      </g>
      <g fill="#FFFFFF" opacity="0.15">
        <circle cx="31" cy="155" r="4" />
        <circle cx="203" cy="156" r="4" />
      </g>
    </g>
  );
}
