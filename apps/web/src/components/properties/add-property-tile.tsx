import { Plus } from 'lucide-react';
import { cx } from '../../lib/cx';

/** A dashed banner under the property cards on My properties that opens "Add property" (admins). */
export function AddPropertyTile({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'group flex w-full items-center gap-4 rounded-card border-2 border-dashed border-line bg-surface/60 p-5 text-left transition-colors',
        'hover:border-sage-mid/60 hover:bg-sage-tint/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-deep',
      )}
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-full bg-sage-tint text-sage-deep transition-transform group-hover:scale-105">
        <Plus aria-hidden className="size-6" />
      </span>
      <span>
        <span className="block font-display text-lg font-semibold text-ink">Add another property</span>
        <span className="mt-0.5 block text-sm text-muted">Its figures, stays and expenses will appear here too.</span>
      </span>
    </button>
  );
}
