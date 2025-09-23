import { supabase } from "@/integrations/supabase/client-resilient";

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