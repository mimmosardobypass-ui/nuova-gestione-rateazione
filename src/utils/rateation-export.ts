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

type PartialStatus = {
  status?: string;
  interrupted_by_rateation_id?: string | null;
};

/**
 * Helper centralizzato "colla" per calcoli export consistenti con UI
 * Usa 'tipo' come discriminante per logica PagoPA interrotte
 */
export function totalsForExport(
  headerRow: any, // riga grezza della view v_rateation_summary
  installments: ExportInstallment[],
  extra: PartialStatus
) {
  // ATTENZIONE: nel progetto la discriminante è "tipo" (non "type")
  const rateationRow: RateationRow = {
    id: String(headerRow.id),
    tipo: String(headerRow.tipo ?? headerRow.type_name ?? 'N/A'),
    numero: headerRow.numero || '',
    number: headerRow.number ?? null,
    taxpayer_name: headerRow.taxpayer_name ?? null,
    total_amount: headerRow.total_amount ?? headerRow.importo_totale ?? 0,
    status: (extra.status ?? 'ATTIVA') as any,
    interrupted_by_rateation_id: extra.interrupted_by_rateation_id ?? null,
    // Campi minimi richiesti dal tipo RateationRow  
    contribuente: headerRow.taxpayer_name ?? null,
    importoTotale: headerRow.importo_totale ?? 0,
    importoPagato: headerRow.importo_pagato_quota ?? 0,
    importoRitardo: 0,
    residuo: 0, // Calcolato da computeRateationTotals
    residuoEffettivo: 0, // Calcolato da computeRateationTotals 
    rateTotali: headerRow.rate_totali ?? 0,
    ratePagate: headerRow.rate_pagate ?? 0,
    rateNonPagate: 0,
    rateInRitardo: headerRow.rate_in_ritardo ?? 0,
    ratePaidLate: 0
  };

  return computeRateationTotals(rateationRow, installments);
}

/**
 * Calcola il residuo usando la stessa logica dell'UI
 */
export function residualForExport(
  viewData: any,
  installments: ExportInstallment[],
  additionalData?: { status?: string; interrupted_by_rateation_id?: string | null }
): number {
  return totalsForExport(viewData, installments, additionalData || {}).residual;
}

/**
 * Calcola il pagato usando la stessa logica dell'UI
 */
export function paidForExport(
  viewData: any,
  installments: ExportInstallment[]
): number {
  return totalsForExport(viewData, installments, {}).paid;
}