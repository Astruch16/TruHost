/** Small icons for list rows and notices, from the custom set (src/assets/icons/notices). 40px by default. */
import type { IconProps } from './defs';
import { IconImage } from './icon-image';

/** A monthly statement: a page with a green header and a small bar chart. */
export function StatementDocIcon({ size = 40, className }: IconProps) {
  return <IconImage path="notices/monthly-statement" size={size} className={className} />;
}

/** An invitation: an envelope with a gold seal. */
export function InviteIcon({ size = 40, className }: IconProps) {
  return <IconImage path="notices/invitation" size={size} className={className} />;
}

/** Somewhere that isn't here: a gold compass. */
export function CompassIcon({ size = 40, className }: IconProps) {
  return <IconImage path="notices/compass" size={size} className={className} />;
}

/** Cleans done: a clipboard with a green tick. */
export function CleanDoneIcon({ size = 40, className }: IconProps) {
  return <IconImage path="notices/cleans-done" size={size} className={className} />;
}

/** Time off: a calendar page with a sun rising over it. */
export function TimeOffIcon({ size = 40, className }: IconProps) {
  return <IconImage path="notices/time-off" size={size} className={className} />;
}

/** This week: a calendar page with one week picked out in gold. */
export function WeekIcon({ size = 40, className }: IconProps) {
  return <IconImage path="notices/this-week" size={size} className={className} />;
}

/** Free from: a door left ajar. */
export function DoorOpenIcon({ size = 40, className }: IconProps) {
  return <IconImage path="notices/free-from" size={size} className={className} />;
}

/** Ready by: an alarm clock. */
export function ReadyByIcon({ size = 40, className }: IconProps) {
  return <IconImage path="notices/ready-by" size={size} className={className} />;
}
