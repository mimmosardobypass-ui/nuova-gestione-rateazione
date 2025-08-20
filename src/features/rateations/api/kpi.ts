import { supabase } from "@/integrations/supabase/client";

/**
 * Ritorna il totale residuo in euro, leggendo valori consolidati dal DB.
 * - Preferisce campi *_cents se presenti
 * - Esclude i piani 'decaduta'
 * - Non usa supabase.auth.getUser() (lasciamo lavorare la RLS)
 */
export async function fetchResidualEuro(signal?: AbortSignal): Promise<number> {
  // 1) Vista unica (se esiste): v_kpi_rateations con campo residual_amount_cents
  try {
    const { data, error } = await supabase
      .from("v_kpi_rateations")
      .select("residual_amount_cents")
      .abortSignal(signal)
      .maybeSingle();

    if (!error && data && typeof data.residual_amount_cents === "number") {
      return data.residual_amount_cents / 100;
    }
  } catch (e) {
    // prosegui con il fallback
    console.warn("fetchResidualEuro: fallback aggregazione per tabella rateations", e);
  }

  // 2) Fallback: somma dai piani, escludendo le decadute
  const { data: rows, error: e2 } = await supabase
    .from("rateations")
    .select("residual_amount_cents, residual_amount, status")
    .neq("status", "decaduta")
    .abortSignal(signal);

  if (e2) throw new Error(`fetchResidualEuro: ${e2.message}`);

  let totalCents = 0;
  for (const r of rows ?? []) {
    if (typeof r?.residual_amount_cents === "number") {
      totalCents += r.residual_amount_cents;
    } else if (typeof r?.residual_amount === "number") {
      totalCents += Math.round(r.residual_amount * 100);
    }
  }
  return totalCents / 100;
}