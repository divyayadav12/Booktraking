import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';

describe('Frontend UI Components', () => {
  it('renders Badge with correct status label and styling', () => {
    const { rerender } = render(<Badge status="COMPLETED" />);
    expect(screen.getByText('Completed')).toBeInTheDocument();

    rerender(<Badge status="PARTIALLY_DISPATCHED" />);
    expect(screen.getByText('Partially Dispatched')).toBeInTheDocument();

    rerender(<Badge status="PENDING" />);
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('renders Button with icon and children', () => {
    render(<Button variant="primary">Verify & Dispatch</Button>);
    const button = screen.getByRole('button', { name: /Verify & Dispatch/i });
    expect(button).toBeInTheDocument();
  });

  it('renders Button in loading state when isLoading is true', () => {
    render(<Button isLoading>Submit</Button>);
    expect(screen.getByText(/Loading.../i)).toBeInTheDocument();
  });
});
