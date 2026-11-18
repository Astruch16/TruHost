import type { IllustrationProps } from './defs';
import { IconImage } from './icon-image';

/** No expenses: a wallet with a card tucked inside. From the custom set (src/assets/icons/empty-states); 96px by default. */
export function ExpensesIllustration({ size = 96, className }: IllustrationProps) {
  return (
    <IconImage
      path="empty-states/no-expenses"
      size={size}
      className={className}
      label="A wallet with a card tucked inside"
    />
  );
}
