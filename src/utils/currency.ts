/**
 * Safe currency parsing utilities for PagoPA quota allocation
 */

/**
 * Converts EUR string to cents with proper handling of Italian decimal separators
 * @param s - String representation of EUR amount (e.g., "1.234,56" or "1234.56")
 * @returns Amount in cents (integer)
 * 
 * @example
 * eurStringToCents("1.234,56") // returns 123456
 * eurStringToCents("1234.56")  // returns 123456  
 * eurStringToCents("invalid")  // returns 0
 */
export const eurStringToCents = (s: string): number => {
  const normalized = s.trim()
    .replace(/\./g, '')     // Remove thousand separators (1.234 -> 1234)
    .replace(',', '.');     // Replace decimal comma with dot (1234,56 -> 1234.56)
  
  const eur = Number(normalized);
  return Number.isFinite(eur) ? Math.round(eur * 100) : 0;
};

/**
 * Converts cents to EUR string with Italian formatting
 * @param cents - Amount in cents
 * @returns Formatted EUR string (e.g., "1.234,56")
 */
export const centsToEurString = (cents: number): string => {
  const eur = cents / 100;
  return eur.toLocaleString('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

/**
 * Converts cents to EUR number
 * @param cents - Amount in cents  
 * @returns EUR amount as number
 */
export const centsToEur = (cents: number): number => {
  return cents / 100;
};