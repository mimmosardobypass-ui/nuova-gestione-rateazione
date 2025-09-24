/**
 * UI-safe parsing utilities per RQ Allocation
 * Funzioni tolleranti che non lanciano durante il render
 */

import { eurToCentsForAllocation } from './rq-allocation';

/**
 * Parsing tollerante per UI - non lancia mai eccezioni
 */
export interface AllocationParseResult {
  cents: number;
  valid: boolean;
}

export function safeParseAllocation(input?: string): AllocationParseResult {
  // Stato intermedio: input vuoto o solo '0'
  if (!input || input.trim() === '' || input.trim() === '0') {
    return { cents: 0, valid: false };
  }

  try {
    const cents = eurToCentsForAllocation(input);
    return { cents, valid: cents > 0 };
  } catch {
    return { cents: -1, valid: false };
  }
}

/**
 * Verifica se la quota è valida per l'allocazione disponibile
 */
export function isQuotaInRange(cents: number, maxAvailable: number): boolean {
  return cents > 0 && cents <= maxAvailable;
}