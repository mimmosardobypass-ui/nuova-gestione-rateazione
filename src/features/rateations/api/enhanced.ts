import { supabase } from "@/integrations/supabase/client-resilient";

export interface RateationSummaryEnhanced {
  id: string;
  number: string;
  type_id: number;
  type_name: string;
  taxpayer_name: string | null;
  total_amount: number;
  rateation_status: string;
  amount_paid: number;
  amount_overdue: number;
  amount_residual: number;
  installments_total: number;
  installments_paid: number;
  installments_unpaid: number;
  installments_overdue: number;
}

export const fetchRateationsSummaryEnhanced = async (signal?: AbortSignal): Promise<RateationSummaryEnhanced[]> => {
  if (signal?.aborted) throw new Error('AbortError');
  
  if (!supabase) {
    console.warn('Supabase client not available, returning empty data');
    return [];
  }
  
  // Get authenticated user first
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error('User not authenticated');
  
  const { data, error } = await supabase
    .from("v_rateations_summary_enhanced")
    .select("*")
    .eq("owner_uid", user.id)
    .order("id", { ascending: false });

  if (signal?.aborted) throw new Error('AbortError');
  if (error) throw error;
  return data || [];
};

export interface InstallmentStatus {
  id: string;
  rateation_id: number;
  seq: number;
  amount: number;
  due_date: string | null;
  is_paid: boolean;
  paid_at: string | null;
  canceled_at: string | null;
  notes: string | null;
  payment_method: string | null;
  receipt_url: string | null;
  postponed: boolean;
  status: 'paid' | 'overdue' | 'due_soon' | 'unpaid' | 'cancelled';
  days_late: number;
}

export const fetchInstallmentsStatus = async (rateationId: string, signal?: AbortSignal): Promise<InstallmentStatus[]> => {
  if (signal?.aborted) throw new Error('AbortError');
  
  const { data, error } = await supabase
    .from("v_installments_status")
    .select("*")
    .eq("rateation_id", rateationId)
    .order("seq");

  if (signal?.aborted) throw new Error('AbortError');
  if (error) throw error;
  return data || [];
};