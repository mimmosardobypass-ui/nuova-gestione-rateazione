import { supabase } from "@/integrations/supabase/client-resilient";

export type KpiBreakdownItem = {
  type_label: string;
  amount_cents: number;
};

export type KpiBreakdown = KpiBreakdownItem[];

/**
 * Totale residuo EFFETTIVO in euro (esclude PagoPA interrotte).
 * Legge la vista v_kpi_rateations_effective che ritorna sempre 1 riga.
 */
export async function fetchResidualEuro(signal?: AbortSignal): Promise<number> {
  if (!supabase) {
    return 0;
  }
  
  const { data, error } = await supabase
    .from("v_kpi_rateations_effective")
    .select("effective_residual_amount_cents")
    .abortSignal(signal)
    .single();                // <-- single: la vista aggregata DEVE dare 1 riga

  if (error) {
    throw new Error(`fetchResidualEuro: ${error.message}`);
  }

  return (data?.effective_residual_amount_cents ?? 0) / 100;
}

/**
 * Totale in ritardo EFFETTIVO in euro (esclude PagoPA interrotte).
 * Legge la vista v_kpi_rateations_overdue_effective che ritorna sempre 1 riga.
 */
export async function fetchOverdueEffectiveEuro(signal?: AbortSignal): Promise<number> {
  if (!supabase) {
    return 0;
  }
  
  const { data, error } = await supabase
    .from("v_kpi_rateations_overdue_effective")
    .select("effective_overdue_amount_cents")
    .abortSignal(signal)
    .single();                // <-- single: la vista aggregata DEVE dare 1 riga

  if (error) {
    throw new Error(`fetchOverdueEffectiveEuro: ${error.message}`);
  }

  return (data?.effective_overdue_amount_cents ?? 0) / 100;
}

/**
 * Totale DOVUTO effettivo in euro (solo debito reale).
 * Legge la vista v_kpi_total_due_effective che ritorna sempre 1 riga.
 */
export async function fetchTotalDueEuro(signal?: AbortSignal): Promise<number> {
  if (!supabase) {
    return 0;
  }
  
  const { data, error } = await supabase
    .from("v_kpi_total_due_effective")
    .select("effective_total_due_cents")
    .abortSignal(signal)
    .single();

  if (error) {
    throw new Error(`fetchTotalDueEuro: ${error.message}`);
  }

  return (data?.effective_total_due_cents ?? 0) / 100;
}

/**
 * Totale PAGATO effettivo in euro (solo debito reale).
 * Legge la vista v_kpi_total_paid_effective che ritorna sempre 1 riga.
 */
export async function fetchTotalPaidEuro(signal?: AbortSignal): Promise<number> {
  if (!supabase) {
    return 0;
  }
  
  const { data, error } = await supabase
    .from("v_kpi_total_paid_effective")
    .select("effective_total_paid_cents")
    .abortSignal(signal)
    .single();

  if (error) {
    throw new Error(`fetchTotalPaidEuro: ${error.message}`);
  }

  return (data?.effective_total_paid_cents ?? 0) / 100;
}

/**
 * Breakdown TOTALE DOVUTO per tipo di rateazione
 */
export async function fetchDueByType(signal?: AbortSignal): Promise<KpiBreakdown> {
  if (!supabase) {
    return [];
  }
  
  const { data, error } = await supabase
    .from("v_kpi_due_by_type")
    .select("type_label, amount_cents")
    .abortSignal(signal);

  if (error) {
    throw new Error(`fetchDueByType: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Breakdown TOTALE PAGATO per tipo di rateazione
 */
export async function fetchPaidByType(signal?: AbortSignal): Promise<KpiBreakdown> {
  if (!supabase) {
    return [];
  }
  
  const { data, error } = await supabase
    .from("v_kpi_paid_by_type")
    .select("type_label, amount_cents")
    .abortSignal(signal);

  if (error) {
    throw new Error(`fetchPaidByType: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Breakdown RESIDUO per tipo di rateazione
 */
export async function fetchResidualByType(signal?: AbortSignal): Promise<KpiBreakdown> {
  if (!supabase) {
    return [];
  }
  
  const { data, error } = await supabase
    .from("v_kpi_residual_by_type")
    .select("type_label, amount_cents")
    .abortSignal(signal);

  if (error) {
    throw new Error(`fetchResidualByType: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Breakdown IN RITARDO per tipo di rateazione
 */
export async function fetchOverdueByType(signal?: AbortSignal): Promise<KpiBreakdown> {
  if (!supabase) {
    return [];
  }
  
  const { data, error } = await supabase
    .from("v_kpi_overdue_by_type")
    .select("type_label, amount_cents")
    .abortSignal(signal);

  if (error) {
    throw new Error(`fetchOverdueByType: ${error.message}`);
  }

  return data ?? [];
}