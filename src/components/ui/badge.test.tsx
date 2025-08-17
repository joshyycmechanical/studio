
import React from 'react';
import { render, screen } from '@testing-library/react';
import { Badge } from './badge';

describe('Badge', () => {
  it('renders the badge with the correct text', () => {
    render(<Badge>Test Badge</Badge>);
    const badgeElement = screen.getByText(/Test Badge/i);
    expect(badgeElement).toBeInTheDocument();
  });

  it('applies the default variant styles', () => {
    render(<Badge>Default Badge</Badge>);
    const badgeElement = screen.getByText(/Default Badge/i);
    expect(badgeElement).toHaveClass('bg-primary');
  });

  it('applies the destructive variant styles', () => {
    render(<Badge variant="destructive">Destructive Badge</Badge>);
    const badgeElement = screen.getByText(/Destructive Badge/i);
    expect(badgeElement).toHaveClass('bg-destructive');
  });
});
