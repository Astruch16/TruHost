import { iconUrl, type IconPath } from '../../lib/icon-files';

/**
 * One of TruHost's custom icons, drawn from its SVG file. Decorative by default (the text beside it says what it is);
 * give `label` where the picture stands on its own, as the empty-state illustrations do.
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
  return (
    <img
      src={iconUrl(path)}
      width={size}
      height={size}
      alt={label ?? ''}
      aria-hidden={label ? undefined : true}
      draggable={false}
      decoding="async"
      className={className}
    />
  );
}
