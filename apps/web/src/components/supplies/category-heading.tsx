import type { SupplyCategory } from '@truhost/shared';
import { SuppliesIcon } from '../illustrations/category-icons';
import { RoomIcon } from '../illustrations/room-icons';
import { CleaningIcon } from '../illustrations/statement-icons';

/** An area's heading in a list of supplies: its icon, its name and how many items are listed under it. */
export function CategoryHeading({
  category,
  label,
  count,
}: {
  category: SupplyCategory;
  label: string;
  count: number;
}) {
  return (
    <h3 className="mb-3 flex items-center gap-2.5 text-base font-bold text-ink">
      <CategoryIcon category={category} />
      {label}{' '}
      <span className="figure text-sm font-medium text-muted">
        {count} {count === 1 ? 'item' : 'items'}
      </span>
    </h3>
  );
}

/** An area's icon: the room it's kept in, the spray bottle for cleaning, the box for the rest. */
export function CategoryIcon({ category, size = 28 }: { category: SupplyCategory; size?: number }) {
  const props = { size, className: 'shrink-0' };
  switch (category) {
    case 'BATHROOM':
      return <RoomIcon type="BATHROOM" {...props} />;
    case 'KITCHEN':
      return <RoomIcon type="KITCHEN" {...props} />;
    case 'LAUNDRY':
      return <RoomIcon type="LAUNDRY" {...props} />;
    case 'CLEANING':
      return <CleaningIcon {...props} />;
    case 'OTHER':
      return <SuppliesIcon {...props} />;
  }
}
