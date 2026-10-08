import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AllClearIllustration } from './all-clear';
import { BookingsIllustration } from './bookings';
import { ComingUpIllustration } from './coming-up';
import { ExpensesIllustration } from './expenses';
import { ReceiptsIllustration } from './receipts';
import { RevenueIllustration } from './revenue';

const ALL = [
  [RevenueIllustration, 'A pie chart with a gold coin', ['ei-pop', 'ei-float']],
  [BookingsIllustration, 'A calendar page with one stay marked', ['ei-grow']],
  [ReceiptsIllustration, 'A paper receipt with a gold seal', ['ei-stamp']],
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
