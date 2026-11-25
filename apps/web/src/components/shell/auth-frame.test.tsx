import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { AuthFrame } from './auth-frame';

describe('AuthFrame', () => {
  it('is a plain white page with one column: the TruHost logo centred at its top, then the page', () => {
    const { container } = render(
      <AuthFrame>
        <h1>Welcome back</h1>
      </AuthFrame>,
    );
    const frame = container.querySelector('[data-auth-frame]')!;
    expect(frame).toHaveClass('bg-white');
    expect(container.querySelector('video')).toBeNull();
    const main = screen.getByRole('main');
    const logo = within(main).getByRole('img', { name: 'TruHost' });
    const heading = within(main).getByRole('heading', { name: 'Welcome back' });
    // The logo comes first, above the page's content.
    expect(logo.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole('banner')).toBeNull();
    expect(screen.queryByText('Better stays. Higher returns.')).toBeNull();
  });
});
