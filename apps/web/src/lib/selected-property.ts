const KEY = 'truhost:selected-property';

/** Last property picked in the switcher. A per-browser convenience only; storage may be unavailable. */
export function readSelectedProperty(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function writeSelectedProperty(id: string): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // Private mode or blocked storage: the switcher still works for this page view.
  }
}
