/**
 * Shared utility for consistent euro formatting across the app
 */
export const formatEuro = (amount: number): string => 
  amount.toLocaleString("it-IT", { style: "currency", currency: "EUR" });