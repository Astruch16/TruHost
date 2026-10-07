import { useId, type CSSProperties } from 'react';
import { cx } from '../../lib/cx';
import {
  GUIDES,
  POSE_GROUND,
  guideLabel,
  poseRecipe,
  type GuideCharacter,
  type GuidePose,
  type GuideShape,
} from '../../lib/guides';

/**
 * One of the three guides in one of five poses, drawn exactly as on docs/design/Mascots.dc.html (waving) and
 * docs/design/Poses.dc.html (the rest). Animations live in styles.css (`th-*`) and stop under prefers-reduced-motion.
 *
 * The SVG carries its own text alternative. Pass `decorative` where the character's name is already shown next to
 * it (the guide picker), so screen readers don't hear it twice.
 */
export function Guide({
  character,
  pose = 'waving',
  size = 120,
  decorative = false,
  ground = true,
  className,
}: {
  character: GuideCharacter;
  pose?: GuidePose;
  /** Rendered width and height in pixels. */
  size?: number;
  decorative?: boolean;
  /** The soft shadow underneath. The guide picker and banners leave it out, as in Onboarding.dc.html. */
  ground?: boolean;
  className?: string;
}) {
  // Gradient and clip ids must be unique per instance: many guides can share a page.
  const id = 'g' + useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const g = GUIDES[character];
  const ref = (name: string) => `url(#${id}-${name})`;
  const shapes = (list: GuideShape[]) => list.map((s, i) => <Shape key={i} shape={s} id={id} />);
  const a11y = decorative
    ? ({ 'aria-hidden': true } as const)
    : ({ role: 'img', 'aria-label': guideLabel(character, pose) } as const);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      className={cx('shrink-0', className)}
      data-guide={character}
      data-pose={pose}
      {...a11y}
    >
      <defs>
        <radialGradient
          id={`${id}-vol`}
          gradientUnits="userSpaceOnUse"
          cx={g.volume.cx}
          cy={g.volume.cy}
          r={g.volume.r}
        >
          {g.volume.stops.map(([offset, color, opacity]) => (
            <stop key={offset} offset={offset} stopColor={color} stopOpacity={opacity} />
          ))}
        </radialGradient>
        <radialGradient id={`${id}-gnd`}>
          <stop offset="0" stopColor="#101412" stopOpacity="0.32" />
          <stop offset="1" stopColor="#101412" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-limb`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.24" />
          <stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="1" stopColor="#101412" stopOpacity="0.3" />
        </linearGradient>
        <clipPath id={`${id}-clip`}>
          <path d={g.clipPath} />
        </clipPath>
      </defs>

      {pose === 'waving' ? (
        <>
          {ground && (
            <ellipse cx={g.wavingGround.cx} cy={g.wavingGround.cy} rx={g.wavingGround.rx} ry="9" fill={ref('gnd')} />
          )}
          <g className="th-bob" style={delay(g.delays.bob)}>
            {g.base.backSways ? <g className="th-sway">{shapes(g.base.back)}</g> : shapes(g.base.back)}
            <g className="th-wave" style={delay(g.delays.wave)}>
              <path d={g.wave.d} fill={g.wave.fill} />
              <path d={g.wave.d} fill={ref('limb')} />
              {shapes(g.wave.extra)}
            </g>
            {shapes(g.base.front)}
            <path d={g.arms.restL} fill={g.armFill} />
            {shapes(g.base.body)}
            <g className="th-blink" style={delay(g.delays.blink)}>
              {shapes(g.eyes)}
              {shapes(g.eyeSparkles)}
            </g>
            {shapes(g.base.face)}
          </g>
        </>
      ) : (
        <Posed character={character} pose={pose} id={id} ground={ground} />
      )}
    </svg>
  );
}

function Posed({
  character,
  pose,
  id,
  ground,
}: {
  character: GuideCharacter;
  pose: Exclude<GuidePose, 'waving'>;
  id: string;
  ground: boolean;
}) {
  const g = GUIDES[character];
  const r = poseRecipe(g, pose);
  const limb = `url(#${id}-limb)`;
  const shapes = (list: GuideShape[]) => list.map((s, i) => <Shape key={i} shape={s} id={id} />);
  return (
    <>
      {ground && (
        <ellipse cx={POSE_GROUND.cx} cy={POSE_GROUND.cy} rx={POSE_GROUND.rx} ry="9" fill={`url(#${id}-gnd)`} />
      )}
      <g className={r.motion}>
        <g transform={r.tilt}>
          {shapes(g.base.back)}
          {shapes(g.base.front)}
          {shapes(g.base.body)}
          {shapes(g.base.face)}
          <path d={r.armL} fill={g.armFill} />
          <path d={r.armL} fill={limb} />
          <g className={r.armRClass}>
            <path d={r.armR} fill={g.armFill} />
            <path d={r.armR} fill={limb} />
          </g>
          {r.paws && <path d={r.paws} fill="#F3E7C4" />}
          {r.eyesOpen && <g transform={r.eyeShift}>{shapes(g.eyes)}</g>}
          {r.eyeArcs && <path d={r.eyeArcs} fill="none" stroke="#1A1D21" strokeWidth="3.5" strokeLinecap="round" />}
        </g>
      </g>
      {r.props === 'confetti' && (
        <g className="th-pop">
          <rect x="24" y="38" width="9" height="9" rx="2" transform="rotate(20 28 42)" fill="#A99BD6" />
          <circle cx="174" cy="36" r="5" fill="#7FA9DC" />
          <rect x="14" y="98" width="8" height="8" rx="2" transform="rotate(-15 18 102)" fill="#E2C15A" />
          <circle cx="186" cy="110" r="4.5" fill="#93BFA0" />
          <circle cx="52" cy="14" r="4" fill="#7FA9DC" />
          <rect x="142" y="8" width="9" height="9" rx="2" transform="rotate(30 146 12)" fill="#E2C15A" />
          <circle cx="100" cy="8" r="3.5" fill="#A99BD6" />
        </g>
      )}
      {r.props === 'thought' && (
        <g className="th-pop">
          <circle cx="152" cy="50" r="4" fill="#FFFFFF" />
          <circle cx="164" cy="36" r="6" fill="#FFFFFF" />
          <circle cx="180" cy="18" r="10" fill="#FFFFFF" />
        </g>
      )}
      {r.props === 'zzz' && (
        <g className="th-float" fill="#5B6068" fontFamily="var(--font-sans)" fontWeight="700">
          <text x="146" y="58" fontSize="16">
            z
          </text>
          <text x="158" y="42" fontSize="21">
            z
          </text>
          <text x="172" y="24" fontSize="27">
            Z
          </text>
        </g>
      )}
    </>
  );
}

function Shape({ shape, id }: { shape: GuideShape; id: string }) {
  if (shape.el === 'clip') {
    return (
      <g clipPath={`url(#${id}-clip)`} opacity={shape.opacity}>
        {shape.children.map((s, i) => (
          <Shape key={i} shape={s} id={id} />
        ))}
      </g>
    );
  }
  const attrs = { ...shape.a };
  // Gradient fills in the data say `url(#vol)`; point them at this instance's defs.
  if (typeof attrs.fill === 'string') attrs.fill = attrs.fill.replace(/^url\(#(\w+)\)$/, `url(#${id}-$1)`);
  const El = shape.el;
  return <El {...attrs} />;
}

const delay = (d?: string): CSSProperties | undefined => (d ? { animationDelay: d } : undefined);
