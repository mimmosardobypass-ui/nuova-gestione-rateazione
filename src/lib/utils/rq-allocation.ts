/**
 * Utility per RQ Allocation System con conversioni e validazioni
 */

import { eurStringToCents, centsToEur } from '@/utils/currency';

/**
 * Converte EUR a cents con validazione robusta per RQ allocations
 */
export function eurToCentsForAllocation(eurValue: string | number): number {
  let cents: number;
  
  if (typeof eurValue === 'string') {
    cents = eurStringToCents(eurValue.trim());
  } else if (typeof eurValue === 'number') {
    if (!Number.isFinite(eurValue) || eurValue < 0) {
      throw new Error('Importo non valido');
    }
    cents = Math.round(eurValue * 100);
  } else {
    throw new Error('Tipo di importo non supportato');
  }
  
  // Validazione allocation-specific
  if (cents <= 0) {
    throw new Error('La quota deve essere maggiore di zero');
  }
  
  if (cents > 999999999) { // ~10M EUR limit
    throw new Error('Importo troppo elevato');
  }
  
  return cents;
}

/**
 * Verifica se un importo è valido per allocation
 */
export function isValidAllocationAmount(eurValue: string | number): boolean {
  try {
    eurToCentsForAllocation(eurValue);
    return true;
  } catch {
    return false;
  }
}

/**
 * Formatta cents per display UI nelle allocations
 */
export function formatAllocationCents(cents: number): string {
  if (!Number.isFinite(cents) || cents < 0) return '€ 0,00';
  return `€ ${centsToEur(cents).toLocaleString('it-IT', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  })}`;
}

/**
 * Calcola percentuale di allocation utilizzata
 */
export function calculateAllocationPercentage(
  allocatedCents: number, 
  totalCents: number
): number {
  if (!totalCents || totalCents <= 0) return 0;
  return Math.round((allocatedCents / totalCents) * 100);
}

/**
 * Genera sommario allocazione per UI
 */
export interface AllocationSummary {
  totalCents: number;
  allocatedCents: number;
  availableCents: number;
  utilizationPercentage: number;
  formattedTotal: string;
  formattedAllocated: string;
  formattedAvailable: string;
  isFullyAllocated: boolean;
  isOverAllocated: boolean;
}

export function createAllocationSummary(
  totalCents: number, 
  allocatedCents: number
): AllocationSummary {
  const availableCents = Math.max(0, totalCents - allocatedCents);
  const utilizationPercentage = calculateAllocationPercentage(allocatedCents, totalCents);
  
  return {
    totalCents,
    allocatedCents,
    availableCents,
    utilizationPercentage,
    formattedTotal: formatAllocationCents(totalCents),
    formattedAllocated: formatAllocationCents(allocatedCents),
    formattedAvailable: formatAllocationCents(availableCents),
    isFullyAllocated: allocatedCents >= totalCents,
    isOverAllocated: allocatedCents > totalCents
  };
}

/**
 * Valida input utente per quota allocation
 */
export interface QuotaValidationResult {
  isValid: boolean;
  errorMessage?: string;
  cents?: number;
}

export function validateQuotaInput(
  input: string, 
  maxAvailableCents?: number
): QuotaValidationResult {
  try {
    const cents = eurToCentsForAllocation(input);
    
    if (maxAvailableCents && cents > maxAvailableCents) {
      const maxEur = centsToEur(maxAvailableCents);
      return {
        isValid: false,
        errorMessage: `Quota massima disponibile: € ${maxEur.toFixed(2)}`
      };
    }
    
    return { isValid: true, cents };
  } catch (error) {
    return {
      isValid: false,
      errorMessage: error instanceof Error ? error.message : 'Importo non valido'
    };
  }
}