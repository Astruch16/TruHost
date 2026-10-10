import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Dialog } from './dialog';

describe('Dialog', () => {
  it('keeps the title fixed and scrolls only the body, inside the rounded card, with the portal scrollbar', () => {
    render(
      <Dialog open onOpenChange={vi.fn()} title="Edit Cedar Suite" footer={<button>Save</button>}>
        <p>Long form</p>
      </Dialog>,
    );
    const card = screen.getByRole('dialog');
    expect(card).toHaveClass('overflow-hidden', 'rounded-card', 'flex-col');
    expect(card).not.toHaveClass('overflow-y-auto');

    const body = screen.getByText('Long form').parentElement!;
    expect(body).toHaveClass('scroll-area', 'overflow-y-auto');
    expect(body).toContainElement(screen.getByRole('button', { name: 'Save' }));
    const header = screen.getByRole('heading', { name: 'Edit Cedar Suite' }).closest('div')!.parentElement!;
    expect(body).not.toContainElement(header);

    // A hairline under the title appears once the body has scrolled, and goes when back at the top.
    expect(header).toHaveClass('border-transparent');
    fireEvent.scroll(body, { target: { scrollTop: 80 } });
    expect(header).toHaveClass('border-line-soft');
    fireEvent.scroll(body, { target: { scrollTop: 0 } });
    expect(header).toHaveClass('border-transparent');
  });
});
