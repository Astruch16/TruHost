import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KeyRound } from 'lucide-react';
import { CleanStatusPill } from '../cleaner/clean-status-pill';
import { Pill } from './pill';

describe('Pill', () => {
  it('leads with a decorative dot, ringed in its tone', () => {
    const { container } = render(<Pill tone="sage">Active</Pill>);
    const pill = screen.getByText('Active');
    expect(pill).toHaveClass('bg-sage-tint', 'text-sage-deep', 'ring-sage-mid/25');
    expect(container.querySelector('[aria-hidden] > .bg-sage-mid')).not.toBeNull();
    expect(container.querySelector('[data-pulse]')).toBeNull();
  });

  it('pulses only when asked, and swaps the dot for an icon or drops it', () => {
    const { container, rerender } = render(
      <Pill tone="amber" pulse>
        In progress
      </Pill>,
    );
    expect(container.querySelector('[data-pulse]')).toHaveClass(
      'motion-safe:animate-[pill-pulse_1.8s_cubic-bezier(0,0,0.2,1)_infinite]',
    );
    rerender(
      <Pill tone="sage" icon={<KeyRound data-testid="key" />}>
        You own this
      </Pill>,
    );
    expect(screen.getByTestId('key').parentElement).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('.bg-sage-mid')).toBeNull();
    rerender(<Pill dot={false}>2 bedrooms</Pill>);
    expect(container.querySelector('[aria-hidden]')).toBeNull();
  });

  it('turns frosted on the deep green, the tone kept in a light dot', () => {
    const { container } = render(
      <Pill tone="amber" glass>
        Estimated
      </Pill>,
    );
    expect(screen.getByText('Estimated')).toHaveClass('bg-white/10', 'text-white');
    expect(screen.getByText('Estimated')).not.toHaveClass('bg-amber-tint');
    expect(container.querySelector('.bg-amber-light')).not.toBeNull();
  });
});

describe('CleanStatusPill', () => {
  it('pulses a clean in progress, and no other status', () => {
    const { container, rerender } = render(<CleanStatusPill status="IN_PROGRESS" />);
    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(container.querySelector('[data-pulse]')).not.toBeNull();
    for (const status of ['SCHEDULED', 'COMPLETE', 'CANCELLED'] as const) {
      rerender(<CleanStatusPill status={status} />);
      expect(container.querySelector('[data-pulse]')).toBeNull();
    }
  });
});
