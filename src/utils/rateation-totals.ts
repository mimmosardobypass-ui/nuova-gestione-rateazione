/**
 * FASE 4: LOGICA DI CALCOLO TOTALI
 * Centralizza il calcolo dei totali per rateazioni PagoPA interrotte
 */

import type { RateationRow, RateationTotals } from "@/features/rateations/types";

export interface SimpleInstallment {
  amount: number;
  is_paid: boolean;
}

/**
 * Calcola i totali per una singola rateazione considerando lo stato di interruzione
 * Per PagoPA INTERROTTA: residuo = 0, conta solo i pagamenti effettuati
 */
export function computeRateationTotals(
  rateation: RateationRow, 
  installments: SimpleInstallment[]
): RateationTotals {
  const paid = installments.filter(i => i.is_paid).reduce((sum, i) => sum + i.amount, 0);
  const unpaid = installments.filter(i => !i.is_paid).reduce((sum, i) => sum + i.amount, 0);
  
  let residual = unpaid;

  // LOGICA CHIAVE: PagoPA interrotta non ha residuo da considerare
  const isInterruptedPagoPA = 
    rateation.tipo === 'PagoPA' && 
    rateation.status === 'INTERROTTA' && 
    !!rateation.interrupted_by_rateation_id;

  if (isInterruptedPagoPA) {
    residual = 0; // ignora il debito residuo
  }

  return {
    paid,
    unpaid,
    residual,
    countPaid: installments.filter(i => i.is_paid).length,
    countUnpaid: installments.filter(i => !i.is_paid).length,
  };
}

/**
 * Somma i totali di più rateazioni
 */
export function sumRateationTotals(totals: RateationTotals[]): RateationTotals {
  return totals.reduce((acc, t) => ({
    paid: acc.paid + t.paid,
    unpaid: acc.unpaid + t.unpaid,
    residual: acc.residual + t.residual, // già normalizzato per PagoPA interrotte
    countPaid: acc.countPaid + t.countPaid,
    countUnpaid: acc.countUnpaid + t.countUnpaid,
  }), { 
    paid: 0, 
    unpaid: 0, 
    residual: 0, 
    countPaid: 0, 
    countUnpaid: 0 
  });
}

/**
 * Verifica se una rateazione è PagoPA interrotta
 */
export function isInterruptedPagoPA(rateation: RateationRow): boolean {
  return rateation.tipo === 'PagoPA' && 
         rateation.status === 'INTERROTTA' && 
         !!rateation.interrupted_by_rateation_id;
}

/**
 * Ottiene il tipo di rateazione per identificare PagoPA e Riam.Quater
 */
export function getRateationType(rateation: RateationRow): 'F24' | 'PagoPA' | 'Riam.Quater' | 'Other' {
  if (rateation.tipo === 'F24') return 'F24';
  if (rateation.tipo === 'PagoPA') return 'PagoPA';
  if (rateation.tipo === 'Riam.Quater') return 'Riam.Quater';
  return 'Other';
}