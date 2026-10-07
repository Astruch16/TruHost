import { cx } from '../../lib/cx';
import { GUIDE_CHARACTERS, GUIDES, type GuideCharacter } from '../../lib/guides';
import { Guide } from './guide';

/**
 * "Choose your guide", as in docs/design/Onboarding.dc.html: a large waving preview with a speech bubble, then one
 * button per character. The parent decides what picking does (Settings saves it straight away).
 */
export function GuidePicker({
  value,
  onChange,
  firstName,
  disabled,
}: {
  value: GuideCharacter;
  onChange: (character: GuideCharacter) => void;
  firstName: string;
  disabled?: boolean;
}) {
  const current = GUIDES[value];
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-start gap-[18px] @md/content:flex-row @md/content:items-end">
        <span
          className="grid size-[132px] shrink-0 place-items-center rounded-full"
          style={{ backgroundColor: current.tint }}
        >
          <Guide key={value} character={value} size={120} ground={false} />
        </span>
        <div className="min-w-0 flex-1 rounded-[4px_16px_16px_16px] bg-ground @md/content:rounded-[16px_16px_16px_4px] px-[18px] py-4">
          <p className="text-xl font-bold tracking-[-0.01em]">
            Hi {firstName}, I’m {current.name}.
          </p>
          <p className="mt-1 text-muted">{current.description}</p>
        </div>
      </div>

      <div>
        <p id="guide-picker-label" className="mb-2.5 text-[13px] font-semibold">
          Choose your guide
        </p>
        <div role="group" aria-labelledby="guide-picker-label" className="grid gap-2.5 @md/content:grid-cols-3">
          {GUIDE_CHARACTERS.map((key) => {
            const g = GUIDES[key];
            const selected = key === value;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={selected}
                disabled={disabled}
                onClick={() => !selected && onChange(key)}
                className={cx(
                  'flex min-h-[60px] cursor-pointer items-center gap-2.5 rounded-inner border border-line bg-surface py-2 pr-3 pl-2 text-left text-ink transition-[box-shadow,background-color] duration-150 hover:bg-sage-tint/40 disabled:cursor-default',
                  selected && 'shadow-[0_0_0_2px_var(--color-primary)]',
                )}
              >
                <span
                  className="grid size-11 shrink-0 place-items-center rounded-full"
                  style={{ backgroundColor: g.tint }}
                >
                  <Guide character={key} size={40} ground={false} decorative />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{g.name}</span>
                  <span className="block text-xs text-muted">{g.kind}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
