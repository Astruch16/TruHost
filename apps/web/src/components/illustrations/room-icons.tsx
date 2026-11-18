import type { RoomType } from '@truhost/shared';
import type { IconPath } from '../../lib/icon-files';
import type { IconProps } from './defs';
import { IconImage } from './icon-image';

const FILE: Record<RoomType, IconPath> = {
  BEDROOM: 'rooms/bedroom',
  BATHROOM: 'rooms/bathroom',
  HALF_BATH: 'rooms/half-bath',
  KITCHEN: 'rooms/kitchen',
  LIVING: 'rooms/living-room',
  DINING: 'rooms/dining-room',
  LAUNDRY: 'rooms/laundry',
  ENTRY: 'rooms/entry',
  OFFICE: 'rooms/office',
  PATIO_DECK: 'rooms/patio-deck',
  HOT_TUB: 'rooms/hot-tub',
  GARAGE: 'rooms/garage',
  OTHER: 'rooms/other-room',
};

/**
 * Each room type's icon, from the custom set (src/assets/icons/rooms): a bed, a tub, a basin, a pot, a sofa, a plate,
 * a washer, a key, a laptop, a parasol, a hot tub, a garage, or sparkles for any other room. 40px by default.
 */
export function RoomIcon({ type, size = 40, className }: IconProps & { type: RoomType }) {
  return <IconImage path={FILE[type]} size={size} className={className} />;
}
