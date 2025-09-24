import { describe, it, expect } from 'vitest';
import { formatEuroFromCents } from '@/lib/formatters';

describe('Monetary Formatting Precision', () => {
  it('handles edge case cent amounts correctly', () => {
    // Critical precision test cases
    expect(formatEuroFromCents(1)).toBe('€ 0,01');
    expect(formatEuroFromCents(2)).toBe('€ 0,02');
    expect(formatEuroFromCents(5)).toBe('€ 0,05');
    expect(formatEuroFromCents(99)).toBe('€ 0,99');
    expect(formatEuroFromCents(100)).toBe('€ 1,00');
    expect(formatEuroFromCents(199)).toBe('€ 1,99');
    
    // Rounding test cases
    expect(formatEuroFromCents(0.4)).toBe('€ 0,00'); // Round down
    expect(formatEuroFromCents(0.5)).toBe('€ 0,01'); // Round up
    expect(formatEuroFromCents(0.6)).toBe('€ 0,01'); // Round up
    
    // Large amounts
    expect(formatEuroFromCents(123456789)).toBe('€ 1.234.567,89');
  });

  it('handles zero and negative amounts', () => {
    expect(formatEuroFromCents(0)).toBe('€ 0,00');
    expect(formatEuroFromCents(-100)).toBe('-€ 1,00');
    expect(formatEuroFromCents(-1)).toBe('-€ 0,01');
  });
});