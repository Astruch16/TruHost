import { useIllustrationIds } from '../../lib/illustration-ids';

/** Three daylight moods, one per property tint (sage, blue, lavender), so cards side by side don't look alike. */
const MOODS = [
  { skyTop: '#CFE3D6', skyBottom: '#F1F5EC', far: '#A9C4B4', near: '#7FA592', lake: '#BFD8CF', sun: '#F6E7B4' },
  { skyTop: '#C9DCF1', skyBottom: '#EEF4FA', far: '#A7BCD6', near: '#7E9DBF', lake: '#BCD3EA', sun: '#FBEFC7' },
  { skyTop: '#DCD3F1', skyBottom: '#F6F1FA', far: '#B8ACD8', near: '#9488BF', lake: '#D3CBEB', sun: '#FBE3C2' },
] as const;

/**
 * A property's stand-in when it has no photo: the sign-in page's landscape by day. Mountains with snow on the peaks, a
 * lake, pines and a log cabin with lit windows and a curl of smoke, lit from the top left like the rest of the
 * illustrations. `index` picks the mood (and mirrors every other one), so neighbouring cards differ. Decorative; it
 * fills its box, cropping the sides rather than stretching.
 */
export function PropertyScene({ index = 0, className }: { index?: number; className?: string }) {
  const { id, url } = useIllustrationIds();
  const m = MOODS[index % MOODS.length]!;
  const mirror = index % 2 === 1;
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMax slice" aria-hidden className={className}>
      <defs>
        <linearGradient id={id.paper} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={m.skyTop} />
          <stop offset="1" stopColor={m.skyBottom} />
        </linearGradient>
        <radialGradient id={id.shadow}>
          <stop offset="0" stopColor="#101412" stopOpacity="0.25" />
          <stop offset="1" stopColor="#101412" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="320" height="180" fill={url.paper} />
      <g transform={mirror ? 'translate(320 0) scale(-1 1)' : undefined}>
        {/* Sun and a soft cloud */}
        <circle cx="252" cy="38" r="16" fill={m.sun} />
        <circle cx="252" cy="38" r="24" fill={m.sun} opacity="0.35" />
        <path d="M58 40 q8 -10 18 -4 q6 -8 15 -2 q10 0 9 8 h-46 q-3 -4 4 -2 Z" fill="#FFFFFF" opacity="0.8" />

        {/* Far range, snow on the high peaks */}
        <path
          d="M-10 112 L44 58 L78 86 L118 44 L162 92 L204 60 L248 98 L290 66 L330 104 L330 130 L-10 130 Z"
          fill={m.far}
        />
        <path d="M118 44 L104 58 L112 56 L118 62 L124 55 L132 58 Z" fill="#FFFFFF" opacity="0.9" />
        <path d="M44 58 L34 68 L41 66 L46 71 L51 66 Z" fill="#FFFFFF" opacity="0.85" />
        <path d="M204 60 L195 69 L202 67 L207 72 L212 68 Z" fill="#FFFFFF" opacity="0.85" />
        {/* Near range, lit on its left faces */}
        <path d="M-10 122 L60 82 L104 108 L150 78 L210 116 L262 90 L330 118 L330 140 L-10 140 Z" fill={m.near} />
        <path d="M60 82 L40 94 L60 92 L74 100 Z M150 78 L132 90 L150 88 L164 96 Z" fill="#FFFFFF" opacity="0.18" />

        {/* Lake with a few ripples */}
        <rect x="-10" y="128" width="340" height="16" fill={m.lake} />
        <path
          d="M30 135 h18 M84 139 h14 M196 134 h20 M262 139 h16"
          stroke="#FFFFFF"
          strokeOpacity="0.7"
          strokeWidth="1.4"
          strokeLinecap="round"
        />

        {/* Near shore */}
        <path d="M-10 142 C60 136 120 146 180 140 C240 134 290 142 330 138 L330 180 L-10 180 Z" fill="#5E8C6E" />
        <path d="M-10 154 C70 148 150 160 220 152 C270 147 300 152 330 150 L330 180 L-10 180 Z" fill="#4E7A5E" />

        {/* Path up to the cabin */}
        <path d="M206 180 C204 168 196 160 184 156 L190 156 C204 160 214 168 218 180 Z" fill="#D8C9A3" opacity="0.85" />

        {/* Cabin: shadow, logs, roof, chimney with smoke, lit windows, door */}
        <ellipse cx="190" cy="157" rx="40" ry="5" fill={url.shadow} />
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

        {/* Pines, darker and larger in front */}
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
    </svg>
  );
}
