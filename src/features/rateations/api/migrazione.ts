import { supabase } from '@/integrations/supabase/client';

export type MigrablePagopa = {
  id: string;
  number: string | null;
  taxpayer_name: string | null;
  status: 'ATTIVA' | 'INTERROTTA' | 'ESTINTA';
  interrupted_by_rateation_id: string | null;
  total_amount: number | null;
};

/**
 * Carica le PagoPA migrabili per una rateazione.
 * Include sempre la PagoPA corrente se è eleggibile per la migrazione.
 */
export async function getMigrablePagopaForRateation(
  rateationId: string
): Promise<MigrablePagopa[]> {
  try {
    const numericId = parseInt(rateationId, 10);
    
    // 1) Recupera il tipo PagoPA
    const { data: pagopaType, error: typeError } = await supabase
      .from('rateation_types')
      .select('id')
      .eq('name', 'PagoPA')
      .single();
    
    if (typeError) throw typeError;

    // 2) Recupera i dati della rateazione corrente
    const { data: currentRateation, error: rateationError } = await supabase
      .from('rateations')
      .select('id, number, taxpayer_name, status, interrupted_by_rateation_id, type_id, total_amount')
      .eq('id', numericId)
      .single();
    
    if (rateationError) throw rateationError;

    // Verifica se è una PagoPA
    const isPagoPA = currentRateation?.type_id === pagopaType.id;
    if (!isPagoPA) return []; // Non è una PagoPA → nulla da migrare

    // 3) Verifica se è già collegata a una RQ
    const { data: existingLinks, error: linkError } = await supabase
      .from('riam_quater_links')
      .select('pagopa_id')
      .eq('pagopa_id', numericId);
    
    if (linkError) throw linkError;

    const alreadyLinked = (existingLinks ?? []).length > 0;
    
    // Verifica eleggibilità
    const isEligible = currentRateation &&
      currentRateation.status !== 'INTERROTTA' &&
      !currentRateation.interrupted_by_rateation_id &&
      !alreadyLinked;

    return isEligible ? [{
      id: currentRateation.id.toString(),
      number: currentRateation.number,
      taxpayer_name: currentRateation.taxpayer_name,
      status: currentRateation.status as 'ATTIVA' | 'INTERROTTA' | 'ESTINTA',
      interrupted_by_rateation_id: currentRateation.interrupted_by_rateation_id?.toString() ?? null,
      total_amount: currentRateation.total_amount ?? null,
    }] : [];

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