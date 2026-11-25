import { cx } from '../../lib/cx';
import { iconSvg, type IconPath } from '../../lib/icon-files';

/** Presentation shared by every icon: monoline strokes in the CSS colour (styles.css `.th-icon`, navy by default). */
const STROKE = {
  xmlns: 'http://www.w3.org/2000/svg',
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  focusable: 'false',
} as const;

/**
 * One of TruHost's custom icons, drawn inline from its SVG file so it takes the CSS colour around it: navy unless a
 * text colour class says otherwise (white on dark surfaces, the danger colour for alerts). Decorative by default (the
 * text beside it says what it is); give `label` where the picture stands on its own, as the empty states do.
 *
 * The markup is the repo's own icon files (src/assets/icons), never user input; lib/icon-files.test.ts checks they
 * hold nothing but drawing.
 */
export function IconImage({
  path,
  size,
  className,
  label,
}: {
  path: IconPath;
  size: number;
  className?: string;
  label?: string;
}) {
  const { viewBox, strokeWidth, body } = iconSvg(path);
  return (
    <svg
      {...STROKE}
      viewBox={viewBox}
      width={size}
      height={size}
      strokeWidth={strokeWidth}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-icon={path}
      className={cx('th-icon', className)}
      dangerouslySetInnerHTML={{ __html: body }}
    />
  );
}

/**
 * A UI icon shown as an empty state, drawn the way the empty-state files are: scaled 1.6× on a 64×64 grid inside a
 * faint dashed ring, with the same line weight. For empty screens that have no illustration of their own (time off,
 * a page that isn't available).
 */
export function IconEmptyState({
  path,
  size = 96,
  className,
  label,
}: {
  path: IconPath;
  size?: number;
  className?: string;
  label?: string;
}) {
  const { body } = iconSvg(path);
  return (
    <svg
      {...STROKE}
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-icon={path}
      className={cx('th-icon', className)}
    >
      <circle cx="32" cy="32" r="30" strokeWidth="1.5" strokeDasharray="3 5" opacity=".3" />
      <g transform="translate(12.8 12.8) scale(1.6)" strokeWidth="1.25" dangerouslySetInnerHTML={{ __html: body }} />
    </svg>
  );
}
