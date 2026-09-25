import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusBadge } from '@/components/ui/status-badge';
import { daysUntil, formatCurrency, timeAgo } from '@/lib/utils';

describe('StatusBadge', () => {
  it('renders the status label with underscores replaced', () => {
    render(<StatusBadge status="IN_TRANSIT" />);
    expect(screen.getByText('IN TRANSIT')).toBeInTheDocument();
  });

  it('applies the status colour class', () => {
    render(<StatusBadge status="AVAILABLE" />);
    expect(screen.getByText('AVAILABLE')).toHaveClass('bg-emerald-100');
  });

  it('falls back to a neutral style for unknown statuses', () => {
    render(<StatusBadge status="SOMETHING_ELSE" />);
    expect(screen.getByText('SOMETHING ELSE')).toBeInTheDocument();
  });
});

describe('format utils', () => {
  it('formats currency in INR style', () => {
    expect(formatCurrency(1234567)).toContain('₹');
    expect(formatCurrency(null)).toBe('—');
  });

  it('computes relative time', () => {
    expect(timeAgo(new Date(Date.now() - 30_000).toISOString())).toBe('30 sec ago');
    expect(timeAgo(null)).toBe('—');
  });

  it('computes days until a future date', () => {
    const d = new Date(Date.now() + 10 * 86_400_000).toISOString();
    expect(daysUntil(d)).toBe(10);
    expect(daysUntil(null)).toBeNull();
  });
});
