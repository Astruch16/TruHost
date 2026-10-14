import { GUIDES } from '../../lib/guides';
import { useMyGuide } from '../../lib/guide-context';
import { Guide } from './guide';

/**
 * The signed-in user's guide, celebrating, on its own tint: for good-news empty states ("All stocked"). Sized like the
 * compact empty state illustrations (88px).
 */
export function CelebratingGuide({ size = 88 }: { size?: number }) {
  const guide = useMyGuide();
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full"
      style={{ width: size, height: size, backgroundColor: GUIDES[guide].tint }}
    >
      <Guide character={guide} pose="celebrating" size={Math.round(size * 0.9)} />
    </span>
  );
}
