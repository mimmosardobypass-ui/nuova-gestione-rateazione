/**
 * Formatters for Statistics Dashboard
 */

import { formatEuroFromCents } from "@/lib/formatters";

export function formatMonth(monthStr: string): string {
  const date = new Date(monthStr);
  return date.toLocaleDateString('it-IT', { year: 'numeric', month: 'short' });
}

export function formatCentsToEur(cents: number): number {
  return cents / 100;
}

export { formatEuroFromCents };
