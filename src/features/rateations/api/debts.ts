import { supabase } from "@/integrations/supabase/client";
import { Debt, RateationDebt, MigrateDebtsParams } from "../types";

// Fetch debts for a rateation
export async function fetchRateationDebts(rateationId: number): Promise<RateationDebt[]> {
  const { data, error } = await supabase
    .from('rateation_debts')
    .select(`
      *,
      debt:debts(*)
    `)
    .eq('rateation_id', rateationId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching rateation debts:', error);
    throw error;
  }

  return (data || []).map(item => ({
    ...item,
    status: item.status as 'active' | 'migrated_out' | 'migrated_in'
  }));
}

// Fetch all debts
export async function fetchAllDebts(): Promise<Debt[]> {
  const { data, error } = await supabase
    .from('debts')
    .select('*')
    .order('number', { ascending: true });

  if (error) {
    console.error('Error fetching debts:', error);
    throw error;
  }

  return data || [];
}

// Create a new debt
export async function createDebt(debt: Omit<Debt, 'id'>): Promise<Debt> {
  const { data, error } = await supabase
    .from('debts')
    .insert(debt)
    .select()
    .single();

  if (error) {
    console.error('Error creating debt:', error);
    throw error;
  }

  return data;
}

// Link debts to a rateation
export async function linkDebtsToRateation(
  rateationId: number, 
  debtIds: string[]
): Promise<void> {
  const links = debtIds.map(debtId => ({
    rateation_id: rateationId,
    debt_id: debtId,
    status: 'active' as const
  }));

  const { error } = await supabase
    .from('rateation_debts')
    .insert(links);

  if (error) {
    console.error('Error linking debts to rateation:', error);
    throw error;
  }
}

// Migrate debts between rateations
export async function migrateDebtsToRQ(params: MigrateDebtsParams): Promise<void> {
  // First, update the source rateation debts to 'migrated_out'
  const { error: updateError } = await supabase
    .from('rateation_debts')
    .update({
      status: 'migrated_out',
      target_rateation_id: params.targetRateationId,
      migrated_at: new Date().toISOString().split('T')[0],
      note: params.note
    })
    .eq('rateation_id', params.sourceRateationId)
    .in('debt_id', params.debtIds)
    .eq('status', 'active');

  if (updateError) {
    console.error('Error updating source debts:', updateError);
    throw updateError;
  }

  // Then, create the target rateation debt links
  const targetLinks = params.debtIds.map(debtId => ({
    rateation_id: params.targetRateationId,
    debt_id: debtId,
    status: 'migrated_in' as const,
    target_rateation_id: params.sourceRateationId,
    migrated_at: new Date().toISOString().split('T')[0],
    note: params.note
  }));

  const { error: insertError } = await supabase
    .from('rateation_debts')
    .upsert(targetLinks, {
      onConflict: 'rateation_id,debt_id',
      ignoreDuplicates: false
    });

  if (insertError) {
    console.error('Error creating target debt links:', insertError);
    throw insertError;
  }
}

// Fetch active debts for a rateation (for migration selection)
export async function fetchActiveDebtsForRateation(rateationId: number): Promise<(RateationDebt & { debt: Debt })[]> {
  const { data, error } = await supabase
    .from('rateation_debts')
    .select(`
      *,
      debt:debts(*)
    `)
    .eq('rateation_id', rateationId)
    .eq('status', 'active')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching active debts:', error);
    throw error;
  }

  return (data || []).map(item => ({
    ...item,
    status: item.status as 'active' | 'migrated_out' | 'migrated_in'
  }));
}

// Fetch RQ rateations for target selection
export async function fetchRQRateations(): Promise<Array<{ id: number; number: string; taxpayer_name?: string }>> {
  const { data, error } = await supabase
    .from('rateations')
    .select('id, number, taxpayer_name, type_id, rateation_types(name)')
    .eq('rateation_types.name', 'RQ')
    .order('number', { ascending: true });

  if (error) {
    console.error('Error fetching RQ rateations:', error);
    throw error;
  }

  return data || [];
}