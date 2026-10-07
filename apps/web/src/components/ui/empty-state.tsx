import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { GUIDES } from '../../lib/guides';
import { useMyGuide } from '../../lib/guide-context';
import { Guide } from '../guide/guide';

type EmptyStateProps = {
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
} & (
  | {
      /** The page's main content is empty: the signed-in user's guide, asleep. At most one per screen. */
      size?: 'page';
      icon?: never;
    }
  | {
      /** A panel among others (dashboard cards and similar): a small icon, no guide. */
      size: 'compact';
      icon: LucideIcon;
    }
);

/** "Nothing here yet": a title, an explanation and an optional action. */
export function EmptyState(props: EmptyStateProps) {
  const { title, children, action } = props;
  return (
    <div className="flex flex-col items-center gap-3 rounded-inner border border-dashed border-line px-6 py-10 text-center">
      {props.size === 'compact' ? (
        <span className="grid size-11 place-items-center rounded-full bg-sage-tint text-sage-deep">
          <props.icon aria-hidden className="size-5" />
        </span>
      ) : (
        <SleepingGuide />
      )}
      <div className="max-w-sm">
        <p className="font-semibold text-ink">{title}</p>
        {children && <div className="mt-1 text-sm text-muted">{children}</div>}
      </div>
      {action}
    </div>
  );
}

function SleepingGuide() {
  const guide = useMyGuide();
  return (
    <span className="grid size-[120px] place-items-center rounded-full" style={{ backgroundColor: GUIDES[guide].tint }}>
      <Guide character={guide} pose="sleeping" size={108} />
    </span>
  );
}
