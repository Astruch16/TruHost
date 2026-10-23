import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AllClearIllustration } from './all-clear';
import { BookingsIllustration } from './bookings';
import { CareIllustration } from './care';
import { ExpenseCategoryIcon } from './category-icons';
import { ComingUpIllustration } from './coming-up';
import { ExpensesIllustration } from './expenses';
import { CleanDoneIcon, CompassIcon, InviteIcon, StatementDocIcon } from './list-icons';
import { ReceiptsIllustration } from './receipts';
import { RevenueIllustration } from './revenue';

const ALL = [
  [RevenueIllustration, 'A pie chart with a gold coin', ['ei-pop', 'ei-float']],
  [BookingsIllustration, 'A calendar page with one stay marked', ['ei-grow']],
  [ReceiptsIllustration, 'A paper receipt with a gold seal', ['ei-stamp']],
  [CareIllustration, 'Two photos of a tidy room with a gold sparkle', ['ei-stamp']],
  [ExpensesIllustration, 'A green wallet with a card tucked inside', ['ei-peek']],
  [ComingUpIllustration, 'A cabin door with a welcome mat', ['ei-glow']],
  [AllClearIllustration, 'A green shield with a check mark', ['ei-float', 'ei-twinkle']],
] as const;

describe('empty state illustrations', () => {
  it.each(ALL)('%o: board label, size and animations', (Illustration, label, classes) => {
    const { container } = render(<Illustration />);
    const svg = screen.getByRole('img', { name: label });
    expect(svg).toHaveAttribute('width', '88');
    expect(svg).toHaveAttribute('viewBox', '0 0 80 80');
    for (const c of classes) expect(container.querySelector(`.${c}`)).not.toBeNull();
  });

  it('gives each instance its own gradient ids, and every fill points at its own', () => {
    const { container } = render(
      <>
        {ALL.map(([Illustration], i) => (
          <Illustration key={`a${i}`} />
        ))}
        {ALL.map(([Illustration], i) => (
          <Illustration key={`b${i}`} />
        ))}
      </>,
    );
    const ids = [...container.querySelectorAll('[id]')].map((el) => el.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    for (const svg of container.querySelectorAll('svg')) {
      const own = new Set([...svg.querySelectorAll('[id]')].map((el) => el.id));
      for (const el of svg.querySelectorAll('[fill^="url("]')) {
        expect(own).toContain(/url\(#(.+)\)/.exec(el.getAttribute('fill')!)![1]);
      }
    }
  });
});

describe('small icons', () => {
  const CATEGORIES = [
    'SUPPLIES',
    'REPAIRS_MAINTENANCE',
    'SUBSCRIPTIONS',
    'UTILITIES',
    'INTERNET',
    'FURNISHINGS',
    'CLEANING',
    'LICENSING_PERMITS',
    'INSURANCE',
    'STRATA',
    'OTHER',
  ];

  it('draws a distinct, decorative 40×40 icon for each expense category, and the receipt for anything else', () => {
    const { container } = render(
      <>
        {CATEGORIES.map((c) => (
          <ExpenseCategoryIcon key={c} category={c} />
        ))}
        <ExpenseCategoryIcon category={null} />
      </>,
    );
    const svgs = [...container.querySelectorAll('svg')];
    expect(svgs).toHaveLength(CATEGORIES.length + 1);
    for (const svg of svgs) {
      expect(svg).toHaveAttribute('aria-hidden', 'true');
      expect(svg).toHaveAttribute('viewBox', '0 0 40 40');
    }
    // Shapes without the per-instance gradient ids: every category but OTHER looks different.
    const shape = (svg: SVGSVGElement) => svg.innerHTML.replace(/ei[^"#)]*-/g, '');
    expect(new Set(svgs.slice(0, -2).map(shape)).size).toBe(CATEGORIES.length - 1);
    expect(shape(svgs.at(-1)!)).toBe(shape(svgs.at(-2)!));
  });

  it('gives each instance its own gradient ids', () => {
    const { container } = render(
      <>
        {[0, 1].map((i) => (
          <span key={i}>
            {CATEGORIES.map((c) => (
              <ExpenseCategoryIcon key={c} category={c} />
            ))}
            <StatementDocIcon />
            <InviteIcon />
            <CompassIcon />
            <CleanDoneIcon />
          </span>
        ))}
      </>,
    );
    const ids = [...container.querySelectorAll('[id]')].map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const svg of container.querySelectorAll('svg')) {
      const own = new Set([...svg.querySelectorAll('[id]')].map((el) => el.id));
      for (const el of svg.querySelectorAll('[fill^="url("]')) {
        expect(own).toContain(/url\(#(.+)\)/.exec(el.getAttribute('fill')!)![1]);
      }
    }
  });
});
