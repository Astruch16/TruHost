import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GuideContext } from '../../lib/guide-context';
import { GUIDE_CHARACTERS, GUIDE_POSES, guideFromApi, guideToApi } from '../../lib/guides';
import { CalendarPlus } from 'lucide-react';
import { Confirmation } from '../ui/confirmation';
import { EmptyState } from '../ui/empty-state';
import { SuccessNotice } from '../ui/success-notice';
import { Guide } from './guide';
import { GuidePicker } from './guide-picker';

describe('Guide', () => {
  it.each(GUIDE_CHARACTERS.flatMap((c) => GUIDE_POSES.map((p) => [c, p] as const)))(
    'draws %s %s with a text alternative',
    (character, pose) => {
      render(<Guide character={character} pose={pose} size={80} />);
      const img = screen.getByRole('img');
      expect(img.getAttribute('aria-label')).toMatch(/^(Sage|Juniper|Pip)\b/);
      expect(img).toHaveAttribute('width', '80');
    },
  );

  it('uses the alternatives from the design boards', () => {
    render(
      <>
        <Guide character="sage" pose="waving" />
        <Guide character="juniper" pose="pointing" />
        <Guide character="pip" pose="celebrating" />
        <Guide character="sage" pose="thinking" />
        <Guide character="juniper" pose="sleeping" />
      </>,
    );
    expect(screen.getAllByRole('img').map((el) => el.getAttribute('aria-label'))).toEqual([
      'Sage, a small green owl with yellow eyes, waving a wing and wearing a gold key',
      'Juniper pointing to one side',
      'Pip celebrating with both arms up',
      'Sage thinking',
      'Juniper asleep',
    ]);
  });

  it('gives every instance its own gradient and clip ids, and points its fills at them', () => {
    const { container } = render(
      <>
        <Guide character="pip" />
        <Guide character="pip" pose="sleeping" />
      </>,
    );
    const ids = [...container.querySelectorAll('[id]')].map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const svg of container.querySelectorAll('svg')) {
      const own = new Set([...svg.querySelectorAll('[id]')].map((el) => el.id));
      const refs = [...svg.querySelectorAll('[fill^="url("], [clip-path^="url("]')].map(
        (el) => /url\(#(.+)\)/.exec(el.getAttribute('fill') ?? el.getAttribute('clip-path') ?? '')![1]!,
      );
      expect(refs.length).toBeGreaterThan(0);
      for (const ref of refs) expect(own).toContain(ref);
    }
  });

  it('is hidden from assistive tech when decorative', () => {
    const { container } = render(<Guide character="juniper" decorative />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('swaps only the arms, eyes and props between poses', () => {
    const { container: waving } = render(<Guide character="sage" pose="waving" />);
    const { container: sleeping } = render(<Guide character="sage" pose="sleeping" />);
    expect(waving.querySelector('.th-wave')).not.toBeNull();
    expect(waving.querySelector('.th-blink')).not.toBeNull();
    expect(sleeping.querySelector('.th-sleep')).not.toBeNull();
    expect(sleeping.querySelector('.th-float')?.textContent).toBe('zzZ');
    // Same base drawing: the body outline is in both.
    const body = 'path[d^="M100 44 C62 44"][fill="#4F7A63"]';
    expect(waving.querySelector(body)).not.toBeNull();
    expect(sleeping.querySelector(body)).not.toBeNull();
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
  it('sleeps in page empty states and celebrates in milestones', () => {
    render(
      <GuideContext.Provider value="pip">
        <EmptyState title="No bookings yet" />
        <SuccessNotice title="Invite sent" />
      </GuideContext.Provider>,
    );
    expect(screen.getByRole('img', { name: 'Pip asleep' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toContainElement(
      screen.getByRole('img', { name: 'Pip celebrating with both arms up' }),
    );
  });

  it('stays out of compact empty states and routine confirmations', () => {
    render(
      <GuideContext.Provider value="pip">
        <EmptyState size="compact" icon={CalendarPlus} title="No stays" />
        <Confirmation>Saved</Confirmation>
      </GuideContext.Provider>,
    );
    expect(screen.getByText('No stays')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
    expect(document.querySelector('[data-guide]')).toBeNull();
  });

  it('defaults to Sage outside the signed-in app', () => {
    render(<EmptyState title="Nothing here" />);
    expect(screen.getByRole('img', { name: 'Sage asleep' })).toBeInTheDocument();
  });
});
