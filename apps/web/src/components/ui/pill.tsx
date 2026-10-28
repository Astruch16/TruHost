import type { ReactNode } from 'react';
import { pillDotStyles, pillStyles, type PillTone } from '../../lib/styles';

/** Status pill: a dot and a label on a soft tint of its tone. Dark for the urgent ("Out") and top-level labels. */
export function Pill({ tone = 'neutral', children }: { tone?: PillTone; children: ReactNode }) {
  return (
    <span className={pillStyles(tone)}>
      <span aria-hidden className={pillDotStyles(tone)} />
      {children}
    </span>
  );
}
