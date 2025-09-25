/**
 * Calcolo risparmio Riammissione Quater
 * Formula: per ogni RQ il risparmio è max(0, allocated_residual_cents_totale - rq_total_due_cents)
 */

export interface QuaterSavingRow {
  is_quater?: boolean;
  allocated_residual_cents?: number;
  allocatedResidualCents?: number;
  rq_total_at_link_cents?: number;
  quater_total_due_cents?: number;
}

/**
 * Calcola il risparmio totale da una lista di rows con collegamenti RQ
 */
export function calcQuaterSavingFromLinks(rows: QuaterSavingRow[]): { quaterSaving: number } {
  const rqRows = rows.filter((r: QuaterSavingRow) => r.is_quater);
  let savingCents = 0;

  for (const rq of rqRows) {
    const allocated = Number(rq.allocated_residual_cents ?? rq.allocatedResidualCents ?? 0);
    const rqTotal = Number(rq.rq_total_at_link_cents ?? rq.quater_total_due_cents ?? 0);
    savingCents += Math.max(0, allocated - rqTotal);
  }

  return { quaterSaving: savingCents / 100 };
}