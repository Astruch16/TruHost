import { Skeleton } from '../ui/skeleton';

/** A page's outline while it loads: header, a row of figure cards, a wide card and a side card. */
export function PageSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-[min(100%,20rem)]" />
        <Skeleton className="h-4 w-[min(100%,28rem)]" />
      </div>
      <div className="grid grid-cols-2 gap-3 @2xl/content:grid-cols-4 @2xl/content:gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-7 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="mt-2 h-1.5 w-full" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 @[68.75rem]/content:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-3 rounded-card border border-line bg-surface p-6">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="mt-3 h-48" />
        </div>
        <div className="flex flex-col gap-3 rounded-card border border-line bg-surface p-6">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="mt-2 h-11" />
          <Skeleton className="h-11" />
          <Skeleton className="h-11" />
        </div>
      </div>
    </div>
  );
}
