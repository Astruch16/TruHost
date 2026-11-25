import type { useIllustrationIds } from '../../lib/illustration-ids';

/** Only the gradients an illustration uses are rendered. */
export function IllustrationDefs({
  ids,
  use,
}: {
  ids: ReturnType<typeof useIllustrationIds>['id'];
  use: ('shadow' | 'sheen' | 'gold' | 'paper')[];
}) {
  return (
    <defs>
      {use.includes('shadow') && (
        <radialGradient id={ids.shadow}>
          <stop offset="0" stopColor="#101412" stopOpacity="0.22" />
          <stop offset="1" stopColor="#101412" stopOpacity="0" />
        </radialGradient>
      )}
      {use.includes('sheen') && (
        <linearGradient id={ids.sheen} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.35" />
          <stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      )}
      {use.includes('gold') && (
        <linearGradient id={ids.gold} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F2D987" />
          <stop offset="1" stopColor="#D9AE3C" />
        </linearGradient>
      )}
      {use.includes('paper') && (
        <linearGradient id={ids.paper} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#F1F2EE" />
        </linearGradient>
      )}
    </defs>
  );
}

/** Props of the empty-state illustrations (96px by default, drawn on a 64×64 grid). */
export interface IllustrationProps {
  size?: number;
  className?: string;
}

/** Props of the small icons (statement lines, expense categories, list rows): 24×24, shown at 20–24px. Decorative. */
export interface IconProps {
  size?: number;
  className?: string;
}
