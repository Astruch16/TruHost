import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: LucideIcon;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-inner border border-dashed border-line px-6 py-10 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-sage-tint text-sage-deep">
        <Icon aria-hidden className="size-5" />
      </span>
      <div className="max-w-sm">
        <p className="font-semibold text-ink">{title}</p>
        {children && <div className="mt-1 text-sm text-muted">{children}</div>}
      </div>
      {action}
    </div>
  );
}
