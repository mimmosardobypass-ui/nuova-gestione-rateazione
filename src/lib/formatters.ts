/**
 * Shared utility for consistent euro formatting across the app
 * Uses explicit rounding to prevent floating-point precision issues
 */
const formatEUR = new Intl.NumberFormat('it-IT', { 
  style: 'currency', 
  currency: 'EUR' 
});

/**
 * @deprecated Use formatEuroFromCents(cents) to avoid ambiguity between EUR and cents
 * This function will be removed in future versions
 */
export const formatEuro = (amount: number): string => {
  if (typeof process !== "undefined" && process.env.NODE_ENV === "development") {
    console.warn("[DEPRECATED] formatEuro(): Use formatEuroFromCents(cents) to avoid EUR/cents ambiguity");
  }
  return amount.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
};

/**
 * Format cents to EUR with explicit rounding - bulletproof precision
 */
export const formatEuroFromCents = (cents: number): string => 
  formatEUR.format(Math.round(cents) / 100);

/**
 * Format date to Italian month (e.g., "2025-03-01" → "mar 2025")
 * Used for time series charts in Statistics V2
 */
export const formatMonth = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('it-IT', { 
    year: 'numeric', 
    month: 'short' 
  });
};