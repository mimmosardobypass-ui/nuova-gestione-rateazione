import { supabase } from "@/integrations/supabase/client";
import type { InstallmentUI } from "../types";

// LOVABLE:START fetchInstallments
export const fetchInstallments = async (rateationId: string, signal?: AbortSignal): Promise<InstallmentUI[]> => {
  if (signal?.aborted) throw new Error('AbortError');
  
  const { data, error } = await supabase
    .from("installments")
    .select("*")
    .eq("rateation_id", rateationId)
    .order("seq");

  if (signal?.aborted) throw new Error('AbortError');
  if (error) throw error;
  return data || [];
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
    p_rateation_id: parseInt(rateationId),
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
    p_installment_id: parseInt(params.installmentId),
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
    p_installment_id: parseInt(params.installmentId),
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
    p_rateation_id: parseInt(rateationId),
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
    p_rateation_id: parseInt(rateationId),
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
    p_rateation_id: parseInt(rateationId),
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
    .eq("rateation_id", rateationId)
    .eq("seq", seq);

  if (error) throw error;
};
// LOVABLE:END deleteInstallment

// LOVABLE:START cancelInstallmentPayment
export const cancelInstallmentPayment = async (installmentId: number): Promise<void> => {
  const { data, error } = await supabase.rpc('cancel_installment_payment', {
    p_installment_id: installmentId,
  });
  if (error) throw error;
  return data;
};
// LOVABLE:END cancelInstallmentPayment
