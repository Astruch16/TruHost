import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AddressMap } from './address-map';
import { AllClearIllustration } from './all-clear';
import { BookingsIllustration } from './bookings';
import { CareIllustration } from './care';
import { ExpenseCategoryIcon } from './category-icons';
import { ComingUpIllustration } from './coming-up';
import { ExpensesIllustration } from './expenses';
import { CleanStepIcon } from './clean-step-icons';
import {
  CleanDoneIcon,
  CompassIcon,
  DoorOpenIcon,
  InviteIcon,
  ReadyByIcon,
  StatementDocIcon,
  WeekIcon,
} from './list-icons';
import { ReceiptsIllustration } from './receipts';
import { RoomIcon } from './room-icons';
import { ROOM_TYPES } from '../../lib/rooms';
import { RevenueIllustration } from './revenue';

const ALL = [
  [RevenueIllustration, 'A rising bar chart'],
  [BookingsIllustration, 'An empty calendar'],
  [ReceiptsIllustration, 'An empty receipt'],
  [CareIllustration, 'Two stacked photos'],
  [ExpensesIllustration, 'A wallet'],
  [ComingUpIllustration, 'A cabin under a crescent moon'],
  [AllClearIllustration, 'A shield with a check mark'],
] as const;

const icons = (container: HTMLElement) => [...container.querySelectorAll('svg[data-icon]')];
const srcs = (container: HTMLElement) => icons(container).map((svg) => svg.getAttribute('data-icon'));

describe('empty state illustrations', () => {
  it.each(ALL)('%o: its own picture, named, 96px by default', (Illustration, label) => {
    render(<Illustration />);
    const img = screen.getByRole('img', { name: label });
    expect(img).toHaveAttribute('width', '96');
    expect(img).toHaveAttribute('viewBox', '0 0 64 64');
    // Drawn inline in the CSS colour, so it can follow the theme.
    expect(img).toHaveAttribute('stroke', 'currentColor');
    expect(img).not.toHaveAttribute('color');
    expect(img.querySelector('*')).not.toBeNull();
  });

  it('draws a different picture for each', () => {
    const { container } = render(
      <>
        {ALL.map(([Illustration], i) => (
          <Illustration key={i} />
        ))}
      </>,
    );
    expect(new Set(srcs(container)).size).toBe(ALL.length);
  });
});

const STEPS = ['BEFORE_PHOTOS', 'DAMAGE', 'STOCK_COUNT', 'AFTER_PHOTOS', 'FINISH'] as const;

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

  it('draws a distinct, decorative 24px icon for each expense category, and the receipt for anything else', () => {
    const { container } = render(
      <>
        {CATEGORIES.map((c) => (
          <ExpenseCategoryIcon key={c} category={c} />
        ))}
        <ExpenseCategoryIcon category={null} />
      </>,
    );
    const imgs = icons(container);
    expect(imgs).toHaveLength(CATEGORIES.length + 1);
    for (const img of imgs) {
      expect(img).toHaveAttribute('aria-hidden', 'true');
      expect(img).toHaveAttribute('width', '24');
      expect(img).toHaveAttribute('viewBox', '0 0 24 24');
      expect(img).toHaveAttribute('stroke-width', '2');
    }
    // Every category but OTHER looks different; OTHER and no category both get the receipt.
    const all = srcs(container);
    expect(new Set(all.slice(0, -2)).size).toBe(CATEGORIES.length - 1);
    expect(all.at(-1)).toBe(all.at(-2));
  });

  it('draws a distinct, decorative icon for each step of a clean’s checklist', () => {
    const { container } = render(
      <>
        {STEPS.map((step) => (
          <CleanStepIcon key={step} step={step} />
        ))}
      </>,
    );
    for (const img of icons(container)) expect(img).toHaveAttribute('aria-hidden', 'true');
    expect(new Set(srcs(container)).size).toBe(STEPS.length);
  });

  it('draws a distinct, decorative icon for each type of room', () => {
    const { container } = render(
      <>
        {ROOM_TYPES.map((type) => (
          <RoomIcon key={type} type={type} />
        ))}
      </>,
    );
    for (const img of icons(container)) expect(img).toHaveAttribute('aria-hidden', 'true');
    expect(new Set(srcs(container)).size).toBe(ROOM_TYPES.length);
  });

  it('draws the list icons, each its own picture', () => {
    const { container } = render(
      <>
        <StatementDocIcon />
        <InviteIcon />
        <CompassIcon />
        <CleanDoneIcon />
        <WeekIcon />
        <DoorOpenIcon />
        <ReadyByIcon />
      </>,
    );
    expect(new Set(srcs(container)).size).toBe(7);
  });

  it('draws the address map as decoration that fills its box without stretching', () => {
    const { container } = render(<AddressMap />);
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('preserveAspectRatio', 'xMidYMid slice');
  });

  it('gives each address map its own gradient ids', () => {
    const { container } = render(
      <>
        <AddressMap />
        <AddressMap />
      </>,
    );
    const ids = [...container.querySelectorAll('[id]')].map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
