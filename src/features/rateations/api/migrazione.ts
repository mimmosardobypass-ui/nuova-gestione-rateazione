import { supabase } from '@/integrations/supabase/client';

export type MigrablePagopa = {
  id: string;
  number: string | null;
  taxpayer_name: string | null;
  status: 'ATTIVA' | 'INTERROTTA' | 'ESTINTA';
  interrupted_by_rateation_id: string | null;
  total_amount: number | null;
  allocatable_cents?: number; // Available quota for allocation
};

/**
 * Carica le PagoPA migrabili per una rateazione usando la nuova vista v_migrable_pagopa.
 * Ora include anche PagoPA già parzialmente collegate se hanno quota residua.
 */
export async function getMigrablePagopaForRateation(
  rateationId: string
): Promise<MigrablePagopa[]> {
  try {
    const numericId = parseInt(rateationId, 10);
    
    // 1) Verifica che la rateazione corrente sia una PagoPA
    const { data: pagopaType, error: typeError } = await supabase
      .from('rateation_types')
      .select('id')
      .eq('name', 'PagoPA')
      .single();
    
    if (typeError) throw typeError;

    const { data: currentRateation, error: rateationError } = await supabase
      .from('rateations')
      .select('id, type_id')
      .eq('id', numericId)
      .single();
    
    if (rateationError) throw rateationError;

    // Verifica se è una PagoPA
    const isPagoPA = currentRateation?.type_id === pagopaType.id;
    if (!isPagoPA) return []; // Non è una PagoPA → nulla da migrare

    // 2) Usa la nuova vista per ottenere PagoPA migrabili (include quota allocabile)
    const { data: migrableData, error: migrableError } = await supabase
      .from('v_migrable_pagopa')
      .select('*')
      .eq('id', numericId);
    
    if (migrableError) throw migrableError;

    return (migrableData || []).map(pagopa => ({
      id: pagopa.id.toString(),
      number: pagopa.number,
      taxpayer_name: pagopa.taxpayer_name,
      status: pagopa.status as 'ATTIVA' | 'INTERROTTA' | 'ESTINTA',
      interrupted_by_rateation_id: pagopa.interrupted_by_rateation_id?.toString() ?? null,
      total_amount: pagopa.total_amount ?? null,
      allocatable_cents: pagopa.allocatable_cents ?? 0,
    }));

  } catch (error) {
    console.error('Error loading migrabile PagoPA:', error);
    throw error;
  }
}

/**
 * Versione estesa che carica tutte le PagoPA dello stesso contribuente 
 * (opzionale per migrazione multipla)
 */
export async function getMigrablePagopaByTaxpayerOf(
  rateationId: string
): Promise<MigrablePagopa[]> {
  try {
    const numericId = parseInt(rateationId, 10);
    
    // Recupera il contribuente della rateazione corrente
    const { data: currentRateation } = await supabase
      .from('rateations')
      .select('taxpayer_name')
      .eq('id', numericId)
      .single();

    if (!currentRateation?.taxpayer_name) return [];

    // Recupera il tipo PagoPA
    const { data: pagopaType } = await supabase
      .from('rateation_types')
      .select('id')
      .eq('name', 'PagoPA')
      .single();

    if (!pagopaType) return [];

    // Recupera tutte le PagoPA dello stesso contribuente
    const { data: candidates } = await supabase
      .from('rateations')
      .select('id, number, taxpayer_name, status, interrupted_by_rateation_id, type_id, total_amount')
      .eq('type_id', pagopaType.id)
      .eq('taxpayer_name', currentRateation.taxpayer_name);

    // Recupera collegamenti esistenti
    const { data: existingLinks } = await supabase
      .from('riam_quater_links')
      .select('pagopa_id');

    const alreadyLinkedSet = new Set((existingLinks ?? []).map(link => link.pagopa_id));

    // Filtra le candidate eleggibili
    return (candidates ?? [])
      .filter(candidate => 
        candidate.status !== 'INTERROTTA' &&
        !candidate.interrupted_by_rateation_id &&
        !alreadyLinkedSet.has(candidate.id)
      )
      .map(candidate => ({
        id: candidate.id.toString(),
        number: candidate.number,
        taxpayer_name: candidate.taxpayer_name,
        status: candidate.status as 'ATTIVA' | 'INTERROTTA' | 'ESTINTA',
        interrupted_by_rateation_id: candidate.interrupted_by_rateation_id?.toString() ?? null,
        total_amount: candidate.total_amount ?? null,
      }));

  } catch (error) {
    console.error('Error loading migrabile PagoPA by taxpayer:', error);
    throw error;
  }
}

/**
 * Verifica i motivi per cui una PagoPA potrebbe non essere migrabile
 */
export function getIneligibilityReasons(
  rateation: any,
  isAlreadyLinked: boolean
): string[] {
  const reasons: string[] = [];

  if (rateation?.status === 'INTERROTTA') {
    reasons.push('La PagoPA è già INTERROTTA');
  }

  if (rateation?.interrupted_by_rateation_id) {
    reasons.push('La PagoPA è già collegata a un\'altra rateazione');
  }

  if (isAlreadyLinked) {
    reasons.push('La PagoPA è già collegata a una RQ');
  }

  return reasons;
}