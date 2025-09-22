/**
 * Helper centralizzato per export che usa la stessa logica UI
 * Garantisce coerenza tra calcoli export e interfaccia utente
 */

import { computeRateationTotals } from '@/utils/rateation-totals';
import type { RateationRow } from '@/features/rateations/types';

export interface ExportInstallment {
  amount: number;
  is_paid: boolean;
}

/**
 * Trasforma i dati della vista v_rateation_summary in RateationRow completa
 */
export function mapToRateationRow(viewData: any, additionalData?: { 
  status?: string;
  interrupted_by_rateation_id?: string | null;
}): RateationRow {
  return {
    id: viewData.id,
    tipo: viewData.type_name || 'N/A',
    numero: viewData.numero || '',
    number: viewData.numero || null,
    taxpayer_name: viewData.taxpayer_name || null,
    total_amount: viewData.importo_totale || 0,
    status: (additionalData?.status as any) || 'ATTIVA',
    interrupted_by_rateation_id: additionalData?.interrupted_by_rateation_id || null,
    // Campi minimi richiesti dal tipo RateationRow  
    contribuente: viewData.taxpayer_name || null,
    importoTotale: viewData.importo_totale || 0,
    importoPagato: viewData.importo_pagato_quota || 0,
    importoRitardo: 0,
    residuo: 0, // Calcolato da computeRateationTotals
    rateTotali: viewData.rate_totali || 0,
    ratePagate: viewData.rate_pagate || 0,
    rateNonPagate: 0,
    rateInRitardo: viewData.rate_in_ritardo || 0,
    ratePaidLate: 0
  };
}

/**
 * Calcola il residuo usando la stessa logica dell'UI
 */
export function residualForExport(
  viewData: any,
  installments: ExportInstallment[],
  additionalData?: { status?: string; interrupted_by_rateation_id?: string | null }
): number {
  const rateationRow = mapToRateationRow(viewData, additionalData);
  return computeRateationTotals(rateationRow, installments).residual;
}

/**
 * Calcola il pagato usando la stessa logica dell'UI
 */
export function paidForExport(
  viewData: any,
  installments: ExportInstallment[]
): number {
  const rateationRow = mapToRateationRow(viewData);
  return computeRateationTotals(rateationRow, installments).paid;
}

/**
 * Calcola tutti i totali usando la stessa logica dell'UI
 */
export function totalsForExport(
  viewData: any,
  installments: ExportInstallment[],
  additionalData?: { status?: string; interrupted_by_rateation_id?: string | null }
) {
  const rateationRow = mapToRateationRow(viewData, additionalData);
  return computeRateationTotals(rateationRow, installments);
}