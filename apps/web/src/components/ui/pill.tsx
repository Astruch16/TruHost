import type { ReactNode } from 'react';
import { pillStyles, type PillTone } from '../../lib/styles';

/** Status pill. Solid dark for urgent ("Out"), soft accent pairs for everything else. */
export function Pill({ tone = 'neutral', children }: { tone?: PillTone; children: ReactNode }) {
  return <span className={pillStyles(tone)}>{children}</span>;
}
