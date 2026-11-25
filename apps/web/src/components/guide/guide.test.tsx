import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GuideContext } from '../../lib/guide-context';
import { GUIDE_CHARACTERS, GUIDES, guideFromApi, guideToApi } from '../../lib/guides';
import { BookingsIllustration } from '../illustrations/bookings';
import { Confirmation } from '../ui/confirmation';
import { EmptyState } from '../ui/empty-state';
import { SuccessNotice } from '../ui/success-notice';
import { Guide } from './guide';
import { GuidePicker } from './guide-picker';

describe('Guide', () => {
  it.each(GUIDE_CHARACTERS)('shows %s in 3D with a text alternative', (character) => {
    const { container } = render(<Guide character={character} size={80} />);
    const img = screen.getByRole('img');
    expect(img.getAttribute('aria-label')).toMatch(/^(Sage|Juniper|Pip), .* wearing a gold key$/);
    expect(img).toHaveStyle({ width: '80px', height: '80px' });
    // The 3D still, not a drawing.
    expect(container.querySelector('img')).toHaveAttribute('src', GUIDES[character].wave.still);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('is hidden from assistive tech when decorative', () => {
    const { container } = render(<Guide character="juniper" decorative />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(container.querySelector('[data-guide]')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('guide values', () => {
  it('maps API values both ways and falls back to Sage', () => {
    expect(guideFromApi('JUNIPER')).toBe('juniper');
    expect(guideFromApi('PIP')).toBe('pip');
    expect(guideFromApi(undefined)).toBe('sage');
    expect(guideFromApi('OTTER')).toBe('sage');
    expect(guideToApi('pip')).toBe('PIP');
  });
});

describe('GuidePicker', () => {
  it('marks the chosen guide, greets by name and reports a new pick', async () => {
    const onChange = vi.fn();
    render(<GuidePicker value="juniper" onChange={onChange} firstName="Sam" />);
    expect(screen.getByText('Hi Sam, I’m Juniper.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Juniper/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Sage/ })).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(screen.getByRole('button', { name: /Pip/ }));
    expect(onChange).toHaveBeenCalledWith('pip');
    await userEvent.click(screen.getByRole('button', { name: /Juniper/ }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe('the signed-in user’s guide', () => {
  it('keeps page empty states and milestones company', () => {
    render(
      <GuideContext.Provider value="pip">
        <EmptyState title="No bookings yet" />
        <SuccessNotice title="Invite sent" />
      </GuideContext.Provider>,
    );
    const [page, notice] = screen.getAllByRole('img', { name: /^Pip, / });
    expect(page).toHaveAttribute('data-guide', 'pip');
    expect(screen.getByRole('status')).toContainElement(notice!);
  });

  it('stays out of compact empty states and routine confirmations', () => {
    render(
      <GuideContext.Provider value="pip">
        <EmptyState size="compact" illustration={<BookingsIllustration />} title="No stays" />
        <Confirmation>Saved</Confirmation>
      </GuideContext.Provider>,
    );
    expect(screen.getByText('No stays')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
    expect(document.querySelector('[data-guide]')).toBeNull();
  });

  it('defaults to Sage outside the signed-in app', () => {
    render(<EmptyState title="Nothing here" />);
    expect(screen.getByRole('img', { name: /^Sage, / })).toBeInTheDocument();
  });
});
