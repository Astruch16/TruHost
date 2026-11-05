import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card } from './card';

describe('Card', () => {
  it('sets the header off from the content with a hairline, only when there is content', () => {
    const { container, rerender } = render(
      <Card title="Rooms" description="4 rooms">
        <p>Content</p>
      </Card>,
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Rooms' })).toBeInTheDocument();
    expect(container.querySelector('header')).toHaveClass('border-b');

    rerender(<Card title="Rooms" description="4 rooms" />);
    expect(container.querySelector('header')).not.toHaveClass('border-b');
  });

  it('has no header without a title, description or actions', () => {
    const { container } = render(
      <Card>
        <p>Content</p>
      </Card>,
    );
    expect(container.querySelector('header')).toBeNull();
  });
});
