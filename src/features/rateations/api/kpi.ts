import { supabase } from "@/integrations/supabase/client-resilient";

/**
 * Totale residuo EFFETTIVO in euro (esclude PagoPA interrotte).
 * Legge la vista v_kpi_rateations_effective per il calcolo homepage.
 */
export async function fetchResidualEuro(signal?: AbortSignal): Promise<number> {
  if (!supabase) {
    return 0;
  }
  
  const { data, error } = await supabase
    .from("v_kpi_rateations_effective")
    .select("effective_residual_amount_cents")
    .abortSignal(signal)
    .single();

  if (error) {
    throw new Error(`fetchResidualEuro: ${error.message}`);
  }

  return (data?.effective_residual_amount_cents ?? 0) / 100;
}