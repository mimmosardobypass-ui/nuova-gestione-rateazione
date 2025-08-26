import { supabase } from "@/integrations/supabase/client-resilient";
import type { RavvedimentoCalculation } from "../types";

/**
 * Preview del calcolo ravvedimento senza salvare
 */
export async function previewRavvedimento(params: {
  amountCents: number;
  dueDate: string;
  paidAt: string;
  profileId?: string;
}): Promise<RavvedimentoCalculation> {
  const { data, error } = await supabase.rpc('compute_ravvedimento', {
    p_amount_cents: params.amountCents,
    p_due_date: params.dueDate,
    p_paid_at: params.paidAt,
    p_profile_id: params.profileId ?? null
  });
  
  if (error) throw error;
  return data as RavvedimentoCalculation;
}

/**
 * Applica ravvedimento e salva nella rata
 */
export async function applyRavvedimento(params: {
  installmentId: number;
  paidAt: string;
  profileId?: string;
}): Promise<RavvedimentoCalculation> {
  const { data, error } = await supabase.rpc('apply_ravvedimento', {
    p_installment_id: params.installmentId,
    p_paid_at: params.paidAt,
    p_profile_id: params.profileId ?? null
  });
  
  if (error) throw error;
  return data as RavvedimentoCalculation;
}

/**
 * Applica ravvedimento manuale con totale inserito dall'utente
 */
export async function applyRavvedimentoManual(params: {
  installmentId: number;
  paidAt: string;
  totalEuro: number;
  profileId?: string;
}) {
  const { data, error } = await supabase.rpc('apply_ravvedimento_manual', {
    p_installment_id: params.installmentId,
    p_paid_at: params.paidAt,
    p_paid_total_cents: Math.round(params.totalEuro * 100),
    p_profile_id: params.profileId ?? null
  });
  
  if (error) throw error;
  return data;
}

/**
 * Fetch profili di ravvedimento disponibili
 */
export async function fetchRavvedimentoProfiles() {
  const { data, error } = await supabase
    .from('ravvedimento_profiles')
    .select('*')
    .order('name');
    
  if (error) throw error;
  return data;
}