import { supabase } from "@/integrations/supabase/client-resilient";
import type { InstallmentUI } from "../types";
import { toIntId } from "@/lib/utils/ids";

// LOVABLE:START fetchInstallments
export const fetchInstallments = async (rateationId: string, signal?: AbortSignal): Promise<InstallmentUI[]> => {
  if (signal?.aborted) throw new Error('AbortError');
  
  const intId = toIntId(rateationId, 'rateationId');
  console.debug('[DEBUG] fetchInstallments call:', { rateationId, casted: intId });
  
  if (!supabase) {
    console.warn('Supabase client not available, returning empty installments');
    return [];
  }
  
  const { data, error } = await supabase
    .from("installments")
    .select("*")
    .eq("rateation_id", intId)
    .order("seq");

  if (signal?.aborted) throw new Error('AbortError');
  if (error) throw error;
  
  console.debug('[DEBUG] fetchInstallments result:', { rateationId, count: data?.length ?? 0 });
  
  if (!data || data.length === 0) {
    console.debug('[DEBUG] No installments found for rateation:', rateationId);
  }
  
  // Ensure consistent payment date mapping and normalize payment status
  return (data || []).map(row => ({
    ...row,
    // Map paid_at to paid_date for consistent access (but only if actually paid)
    paid_date: row.is_paid ? (row.paid_date || row.paid_at || null) : null,
    // Ensure is_paid is boolean
    is_paid: Boolean(row.is_paid),
  }));
};
// LOVABLE:END fetchInstallments

// LOVABLE:START markInstallmentPaid
export const markInstallmentPaidWithDate = async (
  rateationId: string, 
  seq: number, 
  paidAtDate: string // Required date in YYYY-MM-DD format
): Promise<void> => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidAtDate)) {
    throw new Error("Data pagamento non valida (formato atteso YYYY-MM-DD).");
  }

  const { error } = await supabase.rpc("mark_installment_paid", {
    p_rateation_id: toIntId(rateationId, 'rateationId'),
    p_seq: seq,  
    p_paid_at: paidAtDate,
  });

  if (error) throw error;
};

// LOVABLE:START markInstallmentPaidOrdinary
/**
 * Mark installment as paid with ordinary payment (no ravvedimento calculation)
 */
export const markInstallmentPaidOrdinary = async (params: {
  installmentId: string;
  paidDate: string;
  amountPaid?: number;
}): Promise<void> => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.paidDate)) {
    throw new Error("Data pagamento non valida (formato atteso YYYY-MM-DD).");
  }

  const { error } = await supabase.rpc("mark_installment_paid_ordinary_new", {
    p_installment_id: params.installmentId,
    p_paid_date: params.paidDate,
    p_amount_paid: params.amountPaid ?? null,
  });

  if (error) throw error;
};

/**
 * Mark installment as paid with ravvedimento (manual total amount)
 */
export const markInstallmentPaidRavvedimento = async (params: {
  installmentId: string;
  paidDate: string;
  totalPaid: number;
  interest?: number;
  penalty?: number;
}): Promise<void> => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.paidDate)) {
    throw new Error("Data pagamento non valida (formato atteso YYYY-MM-DD).");
  }

  const { error } = await supabase.rpc("mark_installment_paid_ravvedimento_new", {
    p_installment_id: params.installmentId,
    p_paid_date: params.paidDate,
    p_total_paid: params.totalPaid,
    p_interest: params.interest ?? null,
    p_penalty: params.penalty ?? null,
  });

  if (error) throw error;
};
// LOVABLE:END markInstallmentPaidOrdinary

// Keep legacy function for backward compatibility
export const markInstallmentPaid = async (
  rateationId: string, 
  seq: number, 
  paid: boolean, 
  paidAt?: string
): Promise<void> => {
  const { error } = await supabase.rpc("fn_set_installment_paid", {
    p_rateation_id: toIntId(rateationId, 'rateationId'),
    p_seq: seq,
    p_paid: paid,
    p_paid_at: paidAt || null,
  });

  if (error) throw error;
};
// LOVABLE:END markInstallmentPaid

// LOVABLE:START unmarkInstallmentPaid
export const unmarkInstallmentPaid = async (
  rateationId: string, 
  seq: number
): Promise<void> => {
  const { error } = await supabase.rpc("unmark_installment_paid", {
    p_rateation_id: toIntId(rateationId, 'rateationId'),
    p_seq: seq,
  });

  if (error) throw error;
};
// LOVABLE:END unmarkInstallmentPaid

// LOVABLE:START postponeInstallment
export const postponeInstallment = async (
  rateationId: string, 
  seq: number, 
  newDueDate: string
): Promise<void> => {
  if (!newDueDate || new Date(newDueDate) <= new Date()) {
    throw new Error("La nuova data deve essere futura");
  }

  const { error } = await supabase.rpc("fn_postpone_installment", {
    p_rateation_id: toIntId(rateationId, 'rateationId'),
    p_seq: seq,
    p_new_due: newDueDate,
  });

  if (error) throw error;
};
// LOVABLE:END postponeInstallment

// LOVABLE:START deleteInstallment
export const deleteInstallment = async (rateationId: string, seq: number): Promise<void> => {
  const { error } = await supabase
    .from("installments")
    .delete()
    .eq("rateation_id", toIntId(rateationId, 'rateationId'))
    .eq("seq", seq);

  if (error) throw error;
};
// LOVABLE:END deleteInstallment

// LOVABLE:START cancelInstallmentPayment
/**
 * Cancel installment payment using the new atomic RPC function
 * Triggers KPI reload event automatically
 */
export const cancelInstallmentPayment = async (installmentId: number, reason?: string): Promise<void> => {
  const { error } = await supabase.rpc('installment_cancel_payment', {
    p_installment_id: installmentId,
    p_reason: reason ?? null,
  });
  
  if (error) throw error;
  
  // Trigger global KPI reload after successful cancellation
  window.dispatchEvent(new CustomEvent('rateations:reload-kpis'));
};
// LOVABLE:END cancelInstallmentPayment
