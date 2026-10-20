import { useId, useMemo } from 'react';
import { cx } from '../../lib/cx';
import { buildSidebarScene, SCENE_HEIGHT, SCENE_WIDTH, SHORE } from '../../lib/sidebar-scene';
import { useDocumentHidden } from '../../lib/use-viewport';

/**
 * The sidebar's night scene, in the sign-in page's style: a sky that fades in from the sidebar, stars and the moon,
 * two mountain ranges lit from the moon's side with snow on the high peaks, mist, a lake catching the moonlight, a
 * cabin with lit windows and a curl of smoke on the near shore with a path up to it, and pines in three depths with
 * moonlit edges. Decorative only.
 *
 * Quiet motion (a few stars, the smoke, the window glow, the moon on the water, fireflies) pauses while the tab is
 * hidden and stops under reduced motion (styles.css, `lg-*`). The board is 250 × 330 and scales to its box, cropping
 * the sides (never the peaks).
 */
export function MountainScene({ className }: { className?: string }) {
  const scene = useMemo(() => buildSidebarScene(), []);
  const hidden = useDocumentHidden();
  const id = 'sb' + useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const url = (name: string) => `url(#${id}-${name})`;

  return (
    <svg
      aria-hidden
      focusable="false"
      viewBox={`0 0 ${SCENE_WIDTH} ${SCENE_HEIGHT}`}
      preserveAspectRatio="xMidYMax slice"
      className={cx('lg-scene', className)}
      data-paused={hidden || undefined}
    >
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#173f3a" stopOpacity="0" />
          <stop offset="0.3" stopColor="#173f3a" stopOpacity="0.6" />
          <stop offset="0.62" stopColor="#21504a" />
          <stop offset="0.75" stopColor="#2c5f57" />
        </linearGradient>
        <radialGradient id={`${id}-horizon`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#B9ACE6" stopOpacity="0.22" />
          <stop offset="1" stopColor="#B9ACE6" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-moonglow`}>
          <stop offset="0" stopColor="#F4EBC8" stopOpacity="0.38" />
          <stop offset="0.4" stopColor="#F4EBC8" stopOpacity="0.1" />
          <stop offset="1" stopColor="#F4EBC8" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-moon`} cx="0.4" cy="0.36">
          <stop offset="0" stopColor="#FFF8DE" />
          <stop offset="1" stopColor="#E6D8A6" />
        </radialGradient>
        <linearGradient id={`${id}-far`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5d8d82" />
          <stop offset="1" stopColor="#3f6d64" />
        </linearGradient>
        <linearGradient id={`${id}-mid`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3c6b62" />
          <stop offset="1" stopColor="#24504a" />
        </linearGradient>
        <linearGradient id={`${id}-mist`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E8F2EE" stopOpacity="0" />
          <stop offset="0.55" stopColor="#E8F2EE" stopOpacity="0.16" />
          <stop offset="1" stopColor="#E8F2EE" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-lake`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3b6e66" />
          <stop offset="1" stopColor="#1f4a44" />
        </linearGradient>
        <radialGradient id={`${id}-warm`}>
          <stop offset="0" stopColor="#F6D77E" stopOpacity="0.55" />
          <stop offset="1" stopColor="#F6D77E" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-foot`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0e2421" stopOpacity="0" />
          <stop offset="1" stopColor="#0e2421" />
        </linearGradient>
        <linearGradient id={`${id}-path`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#2c5a52" stopOpacity="0.9" />
          <stop offset="1" stopColor="#3d6c62" stopOpacity="0.5" />
        </linearGradient>
      </defs>

      {/* Sky: fades in from the sidebar, with a faint glow along the horizon */}
      <rect width={SCENE_WIDTH} height={SCENE_HEIGHT} fill={url('sky')} />
      <ellipse cx="140" cy="165" rx="150" ry="52" fill={url('horizon')} />
      {scene.stars.map((s, i) => (
        <circle
          key={i}
          cx={s.x}
          cy={s.y}
          r={s.r}
          fill="#F4F1E4"
          opacity={s.o}
          className={s.twinkle ? 'lg-twinkle' : undefined}
          style={s.twinkle ? { animationDelay: s.delay } : undefined}
        />
      ))}

      {/* Moon, a little worn */}
      <circle cx="200" cy="86" r="38" fill={url('moonglow')} />
      <circle cx="200" cy="86" r="10.5" fill={url('moon')} />
      <circle cx="196.5" cy="83" r="2" fill="#D9CB97" opacity="0.55" />
      <circle cx="203.5" cy="90" r="1.4" fill="#D9CB97" opacity="0.5" />
      <circle cx="204" cy="81.5" r="0.9" fill="#D9CB97" opacity="0.45" />

      {/* Far range: hazy, the moonlit faces lighter, snow on the high peaks */}
      <path d={scene.farRange} fill={url('far')} />
      {scene.farLit.map((d) => (
        <path key={d} d={d} fill="#7aa79b" opacity="0.38" />
      ))}
      {scene.farSnow.map((s) => (
        <g key={s.cap}>
          <path d={s.cap} fill="#C9DAD3" opacity="0.85" />
          <path d={s.lit} fill="#F2F6F2" opacity="0.9" />
        </g>
      ))}

      {/* Mid range */}
      <path d={scene.midRange} fill={url('mid')} />
      {scene.midLit.map((d) => (
        <path key={d} d={d} fill="#5d8d82" opacity="0.35" />
      ))}
      {scene.midSnow.map((s) => (
        <g key={s.cap}>
          <path d={s.cap} fill="#B8CEC6" opacity="0.75" />
          <path d={s.lit} fill="#E9F1EC" opacity="0.8" />
        </g>
      ))}

      {/* Mist settling in the valley */}
      <rect y="196" width={SCENE_WIDTH} height="30" fill={url('mist')} />

      {/* Lake, the far shore's treeline, and the moon on the water */}
      <rect y="220" width={SCENE_WIDTH} height="40" fill={url('lake')} />
      <path d={scene.treeline} fill="#244f49" />
      <rect y="222" width={SCENE_WIDTH} height="1.2" fill="#9cc2b7" opacity="0.18" />
      <g stroke="#F4EBC8" strokeLinecap="round">
        <path d="M193 228 h14" strokeWidth="1.3" opacity="0.55" className="lg-shimmer" />
        <path
          d="M195 233 h10"
          strokeWidth="1.1"
          opacity="0.45"
          className="lg-shimmer"
          style={{ animationDelay: '0.7s' }}
        />
        <path
          d="M197 238 h7"
          strokeWidth="1"
          opacity="0.35"
          className="lg-shimmer"
          style={{ animationDelay: '1.4s' }}
        />
      </g>
      <g stroke="#cfe3dc" strokeLinecap="round" strokeWidth="0.8" opacity="0.22">
        {scene.ripples.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>

      {/* Near shore and the cabin's knoll, its edge catching the light */}
      <path d={scene.shore} fill="#1c433d" />
      <path d={SHORE} fill="none" stroke="#4f8478" strokeOpacity="0.35" strokeWidth="0.8" />

      {/* The cabin: log walls, a moonlit roof, lit windows and a curl of smoke. Smoke and fireflies start invisible:
          they only show while animating, so reduced motion leaves them out. */}
      <g transform="translate(-126 0)">
        <ellipse cx="190" cy="257" rx="34" ry="12" fill={url('warm')} className="lg-glow" />
        {['0s', '2s', '4s'].map((delay) => (
          <circle
            key={delay}
            cx="198"
            cy="230"
            r="2.2"
            fill="#cfd9d4"
            opacity="0"
            className="sb-smoke"
            style={{ animationDelay: delay }}
          />
        ))}
        <rect x="196" y="231" width="4" height="9" fill="#3a2a22" />
        <rect x="195.4" y="230" width="5.2" height="1.6" rx="0.4" fill="#2b1f19" />
        <path d="M176 241 L204 241 L204 256 L176 256 Z" fill="#5a3d2d" />
        <path d="M176 245 H204 M176 249 H204 M176 253 H204" stroke="#3f2a1f" strokeWidth="0.6" />
        <path d="M172 242 L190 232 L208 242 Z" fill="#2f211a" />
        <path d="M190 232 L208 242 L205.5 242.6 L190 234 Z" fill="#7d6450" opacity="0.8" />
        <rect x="179.5" y="244.5" width="5.5" height="4.5" rx="0.6" fill="#F6D77E" className="lg-glow" />
        <path d="M182.25 244.5 V249 M179.5 246.75 H185" stroke="#8A6A1C" strokeWidth="0.5" />
        <rect
          x="194.5"
          y="244.5"
          width="5.5"
          height="4.5"
          rx="0.6"
          fill="#F6D77E"
          className="lg-glow"
          style={{ animationDelay: '1.3s' }}
        />
        <path d="M197.25 244.5 V249 M194.5 246.75 H200" stroke="#8A6A1C" strokeWidth="0.5" />
        <rect x="187.2" y="249" width="5" height="7" rx="0.5" fill="#2b1f19" />
        <rect x="187.2" y="249" width="5" height="7" rx="0.5" fill="#F6D77E" opacity="0.35" />
      </g>

      {/* Middle pines, then the ground and the path to the door */}
      <path d={scene.midPines.d} fill="#173a34" />
      <path d={scene.midPines.lit} fill="#2d5a52" opacity="0.8" />
      <path d={scene.ground} fill="#122d29" />
      <path d={scene.path} fill={url('path')} />

      {/* Fireflies near the cabin */}
      {(
        [
          [38, 262, '0s'],
          [92, 266, '1.2s'],
          [24, 276, '2.4s'],
          [108, 254, '3.1s'],
        ] as const
      ).map(([x, y, delay]) => (
        <circle
          key={x}
          cx={x}
          cy={y}
          r="1.1"
          fill="#F6E39A"
          opacity="0"
          className="lg-firefly"
          style={{ animationDelay: delay }}
        />
      ))}

      {/* Front pines framing the scene; the ground fades into the foot's colour along the bottom */}
      <path d={scene.frontPines.d} fill="#0e2421" />
      <path d={scene.frontPines.lit} fill="#1f3f3a" opacity="0.9" />
      <rect y="292" width={SCENE_WIDTH} height="38" fill={url('foot')} />
    </svg>
  );
}
