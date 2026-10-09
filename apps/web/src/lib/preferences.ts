import { createContext, useContext } from 'react';
import type { WeekStart } from './dates';

/** The signed-in user's display preferences (Settings → Preferences). Defaults outside the signed-in app. */
export interface Preferences {
  weekStartsOn: WeekStart;
  motion: 'SYSTEM' | 'REDUCED';
}

export const PreferencesContext = createContext<Preferences>({ weekStartsOn: 0, motion: 'SYSTEM' });
export const useWeekStart = () => useContext(PreferencesContext).weekStartsOn;

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

/** Day names in column order for a week starting on `weekStartsOn`. */
export function weekdayNames(weekStartsOn: WeekStart): string[] {
  return [...DAYS.slice(weekStartsOn), ...DAYS.slice(0, weekStartsOn)];
}

/**
 * "Reduce motion" in Settings: marks the page so styles.css applies the same rules as the system setting. Off
 * (SYSTEM) leaves it to the operating system.
 */
export function applyMotion(motion: Preferences['motion'], root: HTMLElement = document.documentElement): () => void {
  if (motion === 'REDUCED') root.dataset.motion = 'reduced';
  else delete root.dataset.motion;
  return () => {
    delete root.dataset.motion;
  };
}
