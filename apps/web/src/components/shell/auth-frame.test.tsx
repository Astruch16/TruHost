import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { AuthFrame } from './auth-frame';

describe('AuthFrame', () => {
  it('is a plain white page with the TruHost logo in the header, the card and the tagline', () => {
    const { container } = render(
      <AuthFrame>
        <h1>Welcome back</h1>
      </AuthFrame>,
    );
    const frame = container.querySelector('[data-auth-frame]')!;
    expect(frame).toHaveClass('bg-white');
    expect(container.querySelector('video')).toBeNull();
    expect(within(screen.getByRole('banner')).getByRole('img', { name: 'TruHost' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toContainElement(screen.getByRole('heading', { name: 'Welcome back' }));
    expect(screen.getByText('Better stays. Higher returns.')).toHaveClass('font-hand', 'text-ink');
    expect(screen.getByText('Better stays. Higher returns.')).not.toHaveClass('-rotate-3');
  });
});
