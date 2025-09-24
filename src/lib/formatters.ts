/**
 * Shared utility for consistent euro formatting across the app
 * Uses explicit rounding to prevent floating-point precision issues
 */
const formatEUR = new Intl.NumberFormat('it-IT', { 
  style: 'currency', 
  currency: 'EUR' 
});

/**
 * Format cents to EUR with explicit rounding for precision
 */
export const formatEuro = (amount: number): string => 
  amount.toLocaleString("it-IT", { style: "currency", currency: "EUR" });

/**
 * Format cents to EUR with explicit rounding - bulletproof precision
 */
export const formatEuroFromCents = (cents: number): string => 
  formatEUR.format(Math.round(cents) / 100);