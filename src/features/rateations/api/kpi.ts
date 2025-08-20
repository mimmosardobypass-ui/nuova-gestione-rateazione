import { supabase } from "@/integrations/supabase/client";

// Simplified KPI stats wrapper that normalizes residual amounts to euros
export async function fetchKpiStats(signal?: AbortSignal): Promise<{ residualEuro: number }> {
  // Get current user first
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  if (signal?.aborted) throw new Error("AbortError");

  // Fetch all rateations and their installments to calculate residual
  const { data: rateations, error: rateationsError } = await supabase
    .from("rateations")
    .select("id, total_amount")
    .eq("owner_uid", user.id)
    .abortSignal(signal);

  if (rateationsError) throw new Error(`fetchKpiStats: ${rateationsError.message}`);

  if (!rateations || rateations.length === 0) {
    return { residualEuro: 0 };
  }

  const rateationIds = rateations.map(r => r.id);

  // Fetch installments to calculate what's paid
  const { data: installments, error: installmentsError } = await supabase
    .from("installments")
    .select("amount, is_paid")
    .in("rateation_id", rateationIds)
    .abortSignal(signal);

  if (installmentsError) throw new Error(`fetchKpiStats: ${installmentsError.message}`);

  const totalDue = rateations.reduce((sum, r) => sum + Number(r.total_amount || 0), 0);
  const totalPaid = (installments || [])
    .filter(i => i.is_paid)
    .reduce((sum, i) => sum + Number(i.amount || 0), 0);

  const residualEuro = Math.max(0, totalDue - totalPaid);

  return { residualEuro };
}