import type { ReactNode } from 'react';
import { GUIDES } from '../../lib/guides';
import { useMyGuide } from '../../lib/guide-context';
import { cx } from '../../lib/cx';
import { Guide } from '../guide/guide';

/**
 * A milestone: the signed-in user's guide celebrating, on the deep-green banner from docs/design/Onboarding.dc.html.
 * Reserved for real milestones (a completed clean, a finalized statement; see docs/spec.md). Routine actions such as
 * saving or sending use Confirmation instead.
 */
export function SuccessNotice({
  title,
  children,
  className,
}: {
  title: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const guide = useMyGuide();
  return (
    <div
      role="status"
      className={cx('flex items-center gap-3.5 rounded-2xl bg-primary px-[18px] py-3.5 text-primary-ink', className)}
    >
      <span
        className="grid size-14 shrink-0 place-items-center rounded-full"
        style={{ backgroundColor: GUIDES[guide].tint }}
      >
        <Guide character={guide} pose="celebrating" size={50} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold">{title}</p>
        {children && <div className="text-[13px] text-primary-ink-muted">{children}</div>}
      </div>
    </div>
  );
}
