import { supabase } from "@/integrations/supabase/client";
import { Debt, RateationDebt, MigrateDebtsParams } from "../types";

// Fetch debts for a rateation
export async function fetchRateationDebts(rateationId: string): Promise<(RateationDebt & { debt: Debt })[]> {
  const { data, error } = await supabase
    .from('rateation_debts')
    .select(`
      *,
      debt:debts(*)
    `)
    .eq('rateation_id', parseInt(rateationId))
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
  rateationId: string, 
  debtIds: string[]
): Promise<void> {
  const links = debtIds.map(debtId => ({
    rateation_id: parseInt(rateationId),
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

// Migrate debts between rateations using atomic RPC function
export async function migrateDebtsToRQ(params: MigrateDebtsParams): Promise<void> {
  const { error } = await supabase.rpc('migrate_debts_to_rq', {
    p_source_rateation_id: parseInt(params.sourceRateationId),
    p_debt_ids: params.debtIds,
    p_target_rateation_id: parseInt(params.targetRateationId),
    p_note: params.note || null
  });

  if (error) {
    console.error('Migration failed:', error);
    // Provide user-friendly error messages
    if (error.message?.includes('Access denied')) {
      throw new Error('Non hai i permessi per accedere a una delle rateazioni selezionate');
    } else if (error.message?.includes('Cannot migrate to the same rateation')) {
      throw new Error('Non puoi migrare verso la stessa rateazione');
    } else if (error.message?.includes('No active debts found')) {
      throw new Error('Nessuna cartella attiva trovata per la migrazione');
    } else {
      throw new Error('Errore durante la migrazione delle cartelle');
    }
  }
}

// Rollback migration function
export async function rollbackDebtMigration(
  sourceRateationId: string,
  debtIds: string[]
): Promise<void> {
  const { error } = await supabase.rpc('rollback_debt_migration', {
    p_source_rateation_id: parseInt(sourceRateationId),
    p_debt_ids: debtIds
  });

  if (error) {
    console.error('Rollback failed:', error);
    throw new Error('Errore durante il rollback della migrazione');
  }
}

// Fetch active debts for a rateation (for migration selection)
export async function fetchActiveDebtsForRateation(rateationId: string): Promise<(RateationDebt & { debt: Debt })[]> {
  const { data, error } = await supabase
    .from('rateation_debts')
    .select(`
      *,
      debt:debts(*)
    `)
    .eq('rateation_id', parseInt(rateationId))
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

// Fetch RQ rateations for target selection with improved query robustness
export async function fetchRQRateations(): Promise<Array<{ id: string; number: string; taxpayer_name: string | null }>> {
  // First, try to get RQ type ID to avoid potential join issues
  const { data: typeData, error: typeError } = await supabase
    .from('rateation_types')
    .select('id')
    .eq('name', 'RQ')
    .single();

  if (typeError) {
    console.error('Error fetching RQ type:', typeError);
    // Fallback to original query with !inner join
    const { data, error } = await supabase
      .from('rateations')
      .select('id, number, taxpayer_name, type_id, rateation_types!inner(name)')
      .eq('rateation_types.name', 'RQ')
      .order('number', { ascending: true });

    if (error) {
      console.error('Error fetching RQ rateations (fallback):', error);
      throw new Error('Nessun piano RQ trovato nel sistema');
    }

    return (data || []).map(item => ({
      ...item,
      id: item.id.toString() // Convert number to string for consistency
    }));
  }

  // Use the type ID for more robust query
  const { data, error } = await supabase
    .from('rateations')
    .select('id, number, taxpayer_name')
    .eq('type_id', typeData.id)
    .order('number', { ascending: true });

  if (error) {
    console.error('Error fetching RQ rateations:', error);
    throw error;
  }

  return (data || []).map(item => ({
    ...item,
    id: item.id.toString() // Convert number to string for consistency
  }));
}