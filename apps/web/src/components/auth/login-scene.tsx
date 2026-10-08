import { useMemo, type CSSProperties } from 'react';
import { cx } from '../../lib/cx';
import { cullScene, loginScene, sceneViewBox, sceneViewBoxAroundCard } from '../../lib/login-scene';
import { useDocumentHidden, useMediaQuery, useWindowSize } from '../../lib/use-viewport';

/**
 * The night scene behind the sign-in card, ported exactly from docs/design/Login.dc.html: sky, aurora, stars,
 * moon, shooting stars, birds, mountains, three rows of swaying pines, the lake with ripples and the moon's
 * reflection, the cabin with smoke and lit windows, and fireflies. The generated parts come from `loginScene()`,
 * computed once per page load.
 *
 * Kept light: phones skip the blur and grain filters, every animation pauses while the tab is hidden, and
 * prefers-reduced-motion stops all motion (styles.css). One scene per page, so the gradient ids are fixed.
 */
export function LoginScene({
  className,
  card,
}: {
  className?: string;
  /** Where the card sits on screen (px). Phones frame the scene around it so the moon and cabin stay visible. */
  card?: { top: number; bottom: number } | null;
}) {
  const { width, height } = useWindowSize();
  const light = useMediaQuery('(max-width: 640px)');
  const viewBox =
    light && card ? sceneViewBoxAroundCard(width, height, card.top, card.bottom) : sceneViewBox(width, height);
  const scene = useMemo(() => cullScene(loginScene(), viewBox), [viewBox]);
  const hidden = useDocumentHidden();

  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      className={cx('lg-scene block size-full', className)}
      data-paused={hidden || undefined}
    >
      <defs>
        <linearGradient id="lgSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#08141F" />
          <stop offset="0.4" stopColor="#102638" />
          <stop offset="0.64" stopColor="#1A4042" />
          <stop offset="1" stopColor="#2B584F" />
        </linearGradient>
        <radialGradient id="lgHorizon">
          <stop offset="0" stopColor="#B9ACE6" stopOpacity="0.3" />
          <stop offset="1" stopColor="#B9ACE6" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="lgMoonGlow">
          <stop offset="0" stopColor="#F4EBC8" stopOpacity="0.4" />
          <stop offset="0.35" stopColor="#F4EBC8" stopOpacity="0.12" />
          <stop offset="1" stopColor="#F4EBC8" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="lgMoon" cx="0.4" cy="0.38">
          <stop offset="0" stopColor="#FFF8DE" />
          <stop offset="1" stopColor="#E9DDB0" />
        </radialGradient>
        <radialGradient id="lgWarm">
          <stop offset="0" stopColor="#F6D77E" stopOpacity="0.6" />
          <stop offset="1" stopColor="#F6D77E" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="lgPane" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FBE6A0" />
          <stop offset="1" stopColor="#E9B949" />
        </linearGradient>
        <radialGradient id="lgFly">
          <stop offset="0" stopColor="#F6E7A3" stopOpacity="1" />
          <stop offset="1" stopColor="#F6E7A3" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="lgMist" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#DDEBDF" stopOpacity="0" />
          <stop offset="0.5" stopColor="#DDEBDF" stopOpacity="0.13" />
          <stop offset="1" stopColor="#DDEBDF" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="lgLake" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2A5254" />
          <stop offset="1" stopColor="#173336" />
        </linearGradient>
        <linearGradient id="lgTrail" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="1" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        <clipPath id="lgLakeClip">
          <path d="M0 622 Q360 608 720 618 T1440 612 V700 H0Z" />
        </clipPath>
        <linearGradient id="lgReflGrad" gradientUnits="userSpaceOnUse" x1="1150" y1="0" x2="1310" y2="0">
          <stop offset="0" stopColor="#000000" />
          <stop offset="0.5" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#000000" />
        </linearGradient>
        <linearGradient id="lgReflFade" gradientUnits="userSpaceOnUse" x1="0" y1="616" x2="0" y2="700">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#000000" />
        </linearGradient>
        <mask id="lgReflMask">
          <rect x="1100" y="610" width="260" height="95" fill="url(#lgReflGrad)" />
        </mask>
        <mask id="lgDepthMask">
          <rect x="0" y="606" width="1440" height="100" fill="url(#lgReflFade)" />
        </mask>
        <filter id="lgBlur" x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="28" />
        </filter>
        <filter id="lgGrain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
      </defs>

      {/* Plain sky and ground beyond the canvas, for the taller crops phones use. */}
      <rect x="-1440" y="-1800" width="4320" height="1800" fill="#08141F" />
      <rect width="1440" height="900" fill="url(#lgSky)" />
      <ellipse cx="720" cy="560" rx="920" ry="230" fill="url(#lgHorizon)" />

      <g className="lg-drift" filter={light ? undefined : 'url(#lgBlur)'}>
        <path
          d="M-120 250 C180 170 430 300 720 215 C1000 140 1210 250 1560 180 L1560 280 C1210 350 1000 250 720 320 C430 390 180 290 -120 350Z"
          fill="#7FD1A8"
          fillOpacity="0.13"
        />
        <path
          d="M-120 330 C240 270 480 360 760 300 C1040 240 1240 320 1560 270 L1560 330 C1240 380 1040 300 760 360 C480 420 240 340 -120 400Z"
          fill="#B9ACE6"
          fillOpacity="0.12"
        />
      </g>

      {scene.stars.map((s, i) => (
        <circle
          key={i}
          className="lg-twinkle"
          cx={s.x}
          cy={s.y}
          r={s.r}
          fill="#FFFFFF"
          style={{ animationDelay: s.delay, animationDuration: s.dur }}
        />
      ))}
      {scene.sparkles.map((s, i) => (
        <path
          key={i}
          className="lg-twinkle"
          d={s.d}
          fill="#FFFFFF"
          style={{ animationDelay: s.delay, animationDuration: '4s' }}
        />
      ))}

      <circle cx="1230" cy="140" r="170" fill="url(#lgMoonGlow)" />
      <circle cx="1230" cy="140" r="36" fill="url(#lgMoon)" />
      <circle cx="1219" cy="130" r="7" fill="#DCCF9F" fillOpacity="0.7" />
      <circle cx="1242" cy="152" r="5" fill="#DCCF9F" fillOpacity="0.7" />
      <circle cx="1238" cy="124" r="3.500" fill="#DCCF9F" fillOpacity="0.7" />
      <circle cx="1222" cy="154" r="2.500" fill="#DCCF9F" fillOpacity="0.6" />

      <g className="lg-shoot" style={{ animationDelay: '1s' }}>
        <line x1="1060" y1="70" x2="1180" y2="7" stroke="url(#lgTrail)" strokeWidth="2" strokeLinecap="round" />
        <circle cx="1060" cy="70" r="2" fill="#FFFFFF" />
      </g>
      <g className="lg-shoot" style={{ animationDelay: '5.500s', animationDuration: '13s' }}>
        <line x1="560" y1="60" x2="660" y2="8" stroke="url(#lgTrail)" strokeWidth="1.600" strokeLinecap="round" />
        <circle cx="560" cy="60" r="1.700" fill="#FFFFFF" />
      </g>
      <g className="lg-shoot" style={{ animationDelay: '9s', animationDuration: '17s' }}>
        <line x1="1400" y1="230" x2="1500" y2="178" stroke="url(#lgTrail)" strokeWidth="1.800" strokeLinecap="round" />
        <circle cx="1400" cy="230" r="1.800" fill="#FFFFFF" />
      </g>

      <g className="lg-fly">
        <g transform="translate(0 250)">
          <path
            className="lg-flap"
            d="M0 0 q7 -7 14 0 q7 -7 14 0"
            fill="none"
            stroke="#0E1F1C"
            strokeWidth="2.200"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            className="lg-flap"
            style={{ animationDelay: '-.25s' }}
            d="M34 14 q6 -6 12 0 q6 -6 12 0"
            fill="none"
            stroke="#0E1F1C"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            className="lg-flap"
            style={{ animationDelay: '-.45s' }}
            d="M-28 18 q5 -5 10 0 q5 -5 10 0"
            fill="none"
            stroke="#0E1F1C"
            strokeWidth="1.800"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </g>
      <g className="lg-fly" style={{ animationDelay: '-19s', animationDuration: '46s' }}>
        <g transform="translate(0 160)">
          <path
            className="lg-flap"
            style={{ animationDuration: '.9s' }}
            d="M0 0 q5 -5 10 0 q5 -5 10 0"
            fill="none"
            stroke="#0E1F1C"
            strokeWidth="1.700"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            className="lg-flap"
            style={{ animationDelay: '-.3s', animationDuration: '.9s' }}
            d="M24 10 q4 -4 8 0 q4 -4 8 0"
            fill="none"
            stroke="#0E1F1C"
            strokeWidth="1.500"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </g>

      <path
        d="M0 560 L90 472 L170 520 L280 400 L380 500 L470 452 L560 520 L660 380 L760 482 L850 432 L960 512 L1060 392 L1160 472 L1250 422 L1350 500 L1440 442 V900 H0Z"
        fill="#2A4A55"
      />
      <path
        d="M280 400 L380 500 L300 506Z M660 380 L760 482 L684 500Z M1060 392 L1160 472 L1084 500Z M1250 422 L1350 500 L1272 506Z M470 452 L560 520 L486 520Z M850 432 L960 512 L866 514Z"
        fill="#7E9EA6"
        fillOpacity="0.32"
      />
      <path
        d="M280 400 L302 426 L289 421 L278 432 L262 420Z M660 380 L684 408 L670 403 L658 414 L642 401Z M1060 392 L1083 419 L1069 414 L1057 425 L1042 412Z M1250 422 L1268 443 L1257 440 L1247 448 L1236 438Z"
        fill="#E4EEF6"
        fillOpacity="0.85"
      />
      <rect x="0" y="456" width="1440" height="130" fill="url(#lgMist)" />
      <path d="M0 612 Q180 548 340 588 T700 570 T1060 584 T1440 560 V900 H0Z" fill="#1E3D3B" />
      <path
        d="M340 588 Q520 552 700 570 Q560 566 420 590Z M1060 584 Q1250 548 1440 560 Q1260 560 1120 588Z"
        fill="#6E9A8E"
        fillOpacity="0.16"
      />

      {scene.backTrees.map((t, i) => (
        <g key={i} className="lg-sway" style={{ animationDelay: t.delay, animationDuration: t.dur }}>
          <path d={t.d} fill="#17322F" />
          <path d={t.lit} fill="#3A6A5F" fillOpacity="0.45" />
        </g>
      ))}

      <path d="M0 622 Q360 608 720 618 T1440 612 V700 H0Z" fill="url(#lgLake)" />
      <path
        d="M0 622 Q360 608 720 618 T1440 612"
        fill="none"
        stroke="#9FC3BC"
        strokeOpacity="0.25"
        strokeWidth="1.500"
      />
      <g clipPath="url(#lgLakeClip)">
        <g mask="url(#lgDepthMask)">
          {scene.ripples.map((w, i) => (
            <path
              key={i}
              className="lg-wave"
              d={w.d}
              fill="none"
              stroke="#A9CFC6"
              strokeOpacity={w.op}
              strokeWidth="1.300"
              strokeLinecap="round"
              style={{ '--wl': w.wl, animationDuration: w.dur } as CSSProperties}
            />
          ))}
        </g>
        <g mask="url(#lgReflMask)">
          {scene.reflect.map((w, i) => (
            <path
              key={i}
              className="lg-wave"
              d={w.d}
              fill="none"
              stroke="#F4EBC8"
              strokeOpacity={w.op}
              strokeWidth={w.sw}
              strokeLinecap="round"
              style={{ '--wl': w.wl, animationDuration: w.dur } as CSSProperties}
            />
          ))}
        </g>
      </g>
      <rect x="0" y="606" width="1440" height="70" fill="url(#lgMist)" />

      <path d="M0 705 Q240 660 520 690 T1040 676 T1440 668 V900 H0Z" fill="#132A27" />
      <path d="M520 690 Q760 650 1040 676 Q820 672 640 696Z" fill="#6E9A8E" fillOpacity="0.12" />

      {scene.midTrees.map((t, i) => (
        <g key={i} className="lg-sway" style={{ animationDelay: t.delay, animationDuration: t.dur }}>
          <path d={t.d} fill="#0F221E" />
          <path d={t.lit} fill="#46796B" fillOpacity="0.42" />
        </g>
      ))}

      <g transform="translate(-120 0)">
        <ellipse cx="1175" cy="726" rx="150" ry="30" fill="url(#lgWarm)" className="lg-glow" />
        <circle cx="1175" cy="680" r="120" fill="url(#lgWarm)" fillOpacity="0.45" className="lg-glow" />
        <rect x="1110" y="604" width="20" height="70" fill="#474C52" />
        <path
          d="M1110 616 h10 M1120 628 h10 M1110 640 h12 M1118 652 h12 M1110 664 h10"
          stroke="#5C6268"
          strokeWidth="3"
        />
        <rect x="1106" y="600" width="28" height="7" rx="1.500" fill="#3A3E43" />
        <rect x="1098" y="650" width="154" height="72" fill="#4A3428" />
        <path
          d="M1098 659 H1252 M1098 668 H1252 M1098 677 H1252 M1098 686 H1252 M1098 695 H1252 M1098 704 H1252 M1098 713 H1252"
          stroke="#382419"
          strokeWidth="2"
        />
        <path d="M1098 650 H1252 V722 H1238 V650Z" fill="#101412" fillOpacity="0.18" />
        <g fill="#7A5A46">
          <circle cx="1098" cy="655" r="3" />
          <circle cx="1098" cy="664" r="3" />
          <circle cx="1098" cy="673" r="3" />
          <circle cx="1098" cy="682" r="3" />
          <circle cx="1098" cy="691" r="3" />
          <circle cx="1098" cy="700" r="3" />
          <circle cx="1098" cy="709" r="3" />
          <circle cx="1098" cy="718" r="3" />
        </g>
        <path d="M1112 650 L1175 610 L1238 650Z" fill="#553B30" />
        <circle cx="1175" cy="634" r="8" fill="url(#lgPane)" />
        <path d="M1175 626 V642 M1167 634 H1183" stroke="#3A281F" strokeWidth="1.600" />
        <path d="M1084 656 L1175 596 L1266 656 L1258 660 L1175 606 L1092 660Z" fill="#2A2320" />
        <path d="M1175 596 L1266 656 L1258 660 L1175 606Z" fill="#9DB6AE" fillOpacity="0.35" />
        <rect x="1110" y="668" width="30" height="24" rx="1.500" fill="url(#lgPane)" className="lg-glow" />
        <rect x="1110" y="668" width="30" height="24" rx="1.500" fill="none" stroke="#2A1E18" strokeWidth="3" />
        <path d="M1125 668 V692 M1110 680 H1140" stroke="#2A1E18" strokeWidth="2" />
        <rect
          x="1214"
          y="668"
          width="26"
          height="24"
          rx="1.500"
          fill="url(#lgPane)"
          className="lg-glow"
          style={{ animationDelay: '-1.5s' }}
        />
        <rect x="1214" y="668" width="26" height="24" rx="1.500" fill="none" stroke="#2A1E18" strokeWidth="3" />
        <path d="M1227 668 V692 M1214 680 H1240" stroke="#2A1E18" strokeWidth="2" />
        <path d="M1146 676 L1206 676 L1212 684 L1140 684Z" fill="#2A2320" />
        <rect x="1146" y="684" width="4" height="36" fill="#2A2320" />
        <rect x="1200" y="684" width="4" height="36" fill="#2A2320" />
        <rect x="1164" y="688" width="20" height="32" rx="2" fill="#2A1E18" />
        <rect x="1169" y="693" width="10" height="8" rx="1" fill="url(#lgPane)" />
        <circle cx="1180" cy="706" r="1.400" fill="#E2C15A" />
        <circle cx="1194" cy="694" r="16" fill="url(#lgWarm)" className="lg-glow" />
        <rect x="1191" y="689" width="6" height="9" rx="1.500" fill="#F6D77E" />
        <rect x="1140" y="720" width="70" height="5" fill="#2A1E18" />
        <rect x="1158" y="725" width="34" height="4" fill="#3A281F" />
        <path d="M1166 729 Q1150 770 1110 812 L1150 812 Q1176 770 1184 729Z" fill="#3D5C52" fillOpacity="0.55" />
        <circle className="lg-smoke" cx="1120" cy="594" r="6" fill="#C9D4D0" />
        <circle className="lg-smoke" style={{ animationDelay: '2s' }} cx="1120" cy="594" r="6" fill="#C9D4D0" />
        <circle className="lg-smoke" style={{ animationDelay: '4s' }} cx="1120" cy="594" r="6" fill="#C9D4D0" />
      </g>

      {scene.fireflies.map((f, i) => (
        <circle
          key={i}
          className="lg-firefly"
          cx={f.x}
          cy={f.y}
          r="5"
          fill="url(#lgFly)"
          style={{ animationDelay: f.delay, animationDuration: f.dur }}
        />
      ))}

      <path d="M0 826 Q400 794 720 818 T1440 808 V900 H0Z" fill="#0B1A17" />
      {scene.bigTrees.map((t, i) => (
        <g key={i} className="lg-sway" style={{ animationDelay: t.delay, animationDuration: t.dur }}>
          <path d={t.d} fill="#08130F" />
          <path d={t.lit} fill="#507E70" fillOpacity="0.32" />
        </g>
      ))}

      <rect x="-1440" y="899" width="4320" height="1800" fill="#0B1A17" />
      {!light && <rect width="1440" height="900" filter="url(#lgGrain)" opacity="0.06" />}
    </svg>
  );
}
