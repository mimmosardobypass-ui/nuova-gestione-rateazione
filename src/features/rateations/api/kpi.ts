import { supabase } from "@/integrations/supabase/client-resilient";

/**
 * Totale residuo in euro (somma dei piani NON 'decaduta').
 * Legge la vista v_kpi_rateations che ritorna sempre 1 riga.
 */
export async function fetchResidualEuro(signal?: AbortSignal): Promise<number> {
  if (!supabase) {
    return 0;
  }
  
  const { data, error } = await supabase
    .from("v_kpi_rateations")
    .select("residual_amount_cents")
    .abortSignal(signal)
    .single();                // <-- single: la vista aggregata DEVE dare 1 riga

  if (error) {
    throw new Error(`fetchResidualEuro: ${error.message}`);
  }

  return (data?.residual_amount_cents ?? 0) / 100;
}