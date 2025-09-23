/**
 * CENTRALIZED KPI CALCULATIONS
 * Definizioni uniformi per KPI lordi, effettivi e risparmio Quater
 */

import type { RateationRow } from "@/features/rateations/types";

export type GrossKpis = {
  totalDueGross: number;
  totalPaidGross: number;
  residualGross: number;
  overdueGross: number;
};

export type EffectiveKpis = {
  residualEffective: number;
  overdueEffective: number;
  decadutoNet: number;
  commitmentsTotal: number;
};

export type QuaterKpis = {
  quaterSaving: number;
};

/**
 * Calcola i KPI LORDI (include tutte le rateazioni, anche decadute/annullate)
 */
export function calcGrossKpis(rows: RateationRow[]): GrossKpis {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let totalDueGross = 0;
  let totalPaidGross = 0;
  let overdueGross = 0;

  rows.forEach(row => {
    // Somma tutto: totale, pagato, in ritardo
    totalDueGross += row.importoTotale || 0;
    totalPaidGross += row.importoPagato || 0;
    overdueGross += row.importoRitardo || 0;
  });

  const residualGross = Math.max(0, totalDueGross - totalPaidGross);

  return {
    totalDueGross,
    totalPaidGross,
    residualGross,
    overdueGross,
  };
}

/**
 * Calcola i KPI EFFETTIVI (esclude decadute, applica tolleranze/skip)
 */
export function calcEffectiveKpis(rows: RateationRow[]): EffectiveKpis {
  // Separa rateazioni attive da estinte
  const activeRows = rows.filter(row => row.status !== 'ESTINTA');
  const estinteRows = rows.filter(row => row.status === 'ESTINTA');
  
  // Residuo effettivo = residuo delle rateazioni attive (non estinte)
  const residualEffective = activeRows.reduce((sum, row) => {
    return sum + (row.residuoEffettivo || 0);
  }, 0);

  // In ritardo effettivo = con tolleranze e skip applicati
  // TODO: Implementare logica di graceDays e skip PagoPA
  const overdueEffective = activeRows.reduce((sum, row) => {
    // Per ora usiamo il valore base, ma si può raffinare con la logica di tolleranza
    return sum + (row.importoRitardo || 0);
  }, 0);

  // Saldo decaduto (netto) = residuo delle pratiche estinte con decadenza
  const decadutoNet = estinteRows.reduce((sum, row) => {
    const decadenceInfo = row.decadence_info;
    if (decadenceInfo) {
      return sum + (decadenceInfo.residual_at_decadence || 0) - (decadenceInfo.transferred_amount || 0);
    }
    return sum;
  }, 0);

  // Totale impegni = residuo effettivo + saldo decaduto
  const commitmentsTotal = residualEffective + decadutoNet;

  return {
    residualEffective,
    overdueEffective,
    decadutoNet,
    commitmentsTotal,
  };
}

/**
 * Calcola il risparmio da Rottamazione Quater
 * Solo per rateazioni con is_quater = true
 */
export function calcQuaterSaving(rows: RateationRow[]): QuaterKpis {
  const quaterRows = rows.filter(row => row.is_quater === true);
  
  const quaterSaving = quaterRows.reduce((sum, row) => {
    const originalTotal = (row.original_total_due_cents || 0) / 100;
    const quaterTotal = (row.quater_total_due_cents || 0) / 100;
    
    // Il risparmio è la differenza tra debito originario e importo ridotto
    return sum + Math.max(0, originalTotal - quaterTotal);
  }, 0);

  return {
    quaterSaving,
  };
}

/**
 * Calcola tutti i KPI in una volta
 */
export function calcAllKpis(rows: RateationRow[]) {
  return {
    ...calcGrossKpis(rows),
    ...calcEffectiveKpis(rows),
    ...calcQuaterSaving(rows),
  };
}

/**
 * Formattazione tooltip per KPI
 */
export const KPI_TOOLTIPS = {
  residualEffective: "Quota residua escludendo le pratiche decadute.",
  overdueEffective: "Rate scadute non pagate dopo tolleranza e regole di skip.",
  decadutoNet: "Importo residuo delle pratiche decadute da trasferire.",
  commitmentsTotal: "Somma di Residuo effettivo e Saldo decaduto.",
  quaterSaving: "Differenza tra debito originario e importo ridotto con Rottamazione Quater.",
  residualGross: "Dovuto meno pagato, include anche pratiche decadute.",
  totalDueGross: "Importo totale dovuto di tutte le rateazioni.",
  totalPaidGross: "Importo totale pagato di tutte le rateazioni.",
  overdueGross: "Rate scadute non pagate senza tolleranze.",
} as const;