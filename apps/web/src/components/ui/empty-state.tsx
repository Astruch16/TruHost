import type { ReactNode } from 'react';
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
      illustration?: never;
    }
  | {
      /**
       * A panel among others (dashboard cards and similar): one of the empty state illustrations
       * (components/illustrations, docs/design/EmptyIcons.dc.html), no guide.
       */
      size: 'compact';
      illustration: ReactNode;
    }
);

/** "Nothing here yet": a title, an explanation and an optional action. */
export function EmptyState(props: EmptyStateProps) {
  const { title, children, action } = props;
  if (props.size === 'compact') {
    // Layout from docs/design/EmptyIcons.dc.html: illustration, bold title, a short line, then the action.
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
        {props.illustration}
        <p className="font-bold text-ink">{title}</p>
        {children && <div className="max-w-[260px] text-sm text-muted">{children}</div>}
        {action}
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-3 rounded-inner border border-dashed border-line px-6 py-10 text-center">
      <SleepingGuide />
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
