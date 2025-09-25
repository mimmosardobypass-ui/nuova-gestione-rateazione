import { supabase } from '@/integrations/supabase/client';
import { toIntId } from '@/lib/utils/ids';

/**
 * Tipo di ritorno per linkPagopaToRQ
 */
export interface RqLinkResult {
  pagopa_id: number;
  riam_quater_id: number;
  allocated_residual_cents: number;
  reason?: string;
  action: 'created' | 'updated';
}

/**
 * Mappatura errori DB → messaggi utente
 */
export function mapRqLinkError(error: any): string {
  const errorMessage = error?.message || String(error);
  
  // Errori strutturati dalla RPC
  if (errorMessage.includes('INVALID_QUOTA:')) {
    return 'La quota deve essere maggiore di zero';
  }
  if (errorMessage.includes('PAGOPA_ACCESS_DENIED:')) {
    return 'Piano PagoPA non trovato o accesso negato';
  }
  if (errorMessage.includes('RQ_ACCESS_DENIED:')) {
    return 'Riammissione Quater non trovata o accesso negato';
  }
  if (errorMessage.includes('INVALID_PAGOPA_TYPE:')) {
    return 'Il piano selezionato deve essere di tipo PagoPA';
  }
  if (errorMessage.includes('INVALID_RQ_TYPE:')) {
    return 'Il piano destinazione deve essere una Riammissione Quater';
  }
  if (errorMessage.includes('INSUFFICIENT_QUOTA:')) {
    const match = errorMessage.match(/Available: (\d+), requested: (\d+)/);
    if (match) {
      const available = Number(match[1]) / 100;
      const requested = Number(match[2]) / 100;
      return `Quota richiesta (€ ${requested.toFixed(2)}) superiore al residuo disponibile (€ ${available.toFixed(2)})`;
    }
    return 'Quota richiesta superiore al residuo disponibile della PagoPA';
  }
  
  // Errori generici
  if (errorMessage.includes('access denied') || errorMessage.includes('not found')) {
    return 'Accesso negato o piano non trovato';
  }
  
  return 'Errore durante il collegamento. Riprovare o contattare il supporto.';
}

/**
 * Crea o aggiorna un collegamento tra PagoPA e RQ con quota allocata
 * Usa RPC transazionale per massima robustezza
 */
export async function linkPagopaToRQ(
  pagopaId: number | string, 
  rqId: number | string, 
  allocatedCents: number,
  note?: string
): Promise<RqLinkResult> {
  try {
    // 1. Validazioni tipo-safe
    const validPagopaId = toIntId(pagopaId, 'pagopaId');
    const validRqId = toIntId(rqId, 'rqId');
    
    if (!Number.isInteger(allocatedCents) || allocatedCents <= 0) {
      throw new Error('INVALID_QUOTA: Allocated quota must be an integer > 0');
    }

    // 2. Chiamata RPC transazionale (race-condition proof)
    const { data, error } = await supabase.rpc('link_pagopa_to_rq_atomic', {
      p_pagopa_id: validPagopaId,
      p_rq_id: validRqId,
      p_alloc_cents: allocatedCents,
      p_reason: note || null
    });

    if (error) throw error;

    if (!data || data.length === 0) {
      throw new Error('Nessun risultato dalla funzione di collegamento');
    }

    const result = data[0];
    
    // 3. Logging per osservabilità
    console.log('RQ allocation success:', {
      pagopaId: validPagopaId,
      rqId: validRqId,
      allocatedCents,
      action: result.action,
      timestamp: new Date().toISOString()
    });

    // 4. Return typed result per UI refresh
    return {
      pagopa_id: Number(result.pagopa_id),
      riam_quater_id: Number(result.riam_quater_id),
      allocated_residual_cents: Number(result.allocated_residual_cents),
      reason: result.reason || undefined,
      action: result.action as 'created' | 'updated'
    };

  } catch (error) {
    console.error('Error linking PagoPA to RQ:', error);
    
    // Mappa errore per UX
    const userMessage = mapRqLinkError(error);
    const enhancedError = new Error(userMessage);
    (enhancedError as any).originalError = error;
    
    throw enhancedError;
  }
}

/**
 * Rimuove un collegamento specifico tra PagoPA e RQ usando RPC transazionale
 */
export async function unlinkPagopaFromRQ(
  pagopaId: number | string, 
  rqId: number | string,
  note?: string
): Promise<{ pagopa_id: number; riam_quater_id: number; action: string; unlocked: boolean }> {
  try {
    // Validazioni tipo-safe
    const validPagopaId = toIntId(pagopaId, 'pagopaId');
    const validRqId = toIntId(rqId, 'rqId');

    // Chiamata RPC transazionale
    const { data, error } = await supabase.rpc('link_pagopa_unlink', {
      p_pagopa_id: validPagopaId,
      p_rq_id: validRqId,
      p_reason: note || null
    });

    if (error) throw error;

    if (!data || data.length === 0) {
      throw new Error('Nessun risultato dalla funzione di scollegamento');
    }

    const result = data[0];
    
    // Logging per osservabilità
    console.log('RQ unlink result:', {
      pagopaId: validPagopaId,
      rqId: validRqId,
      action: result.action,
      timestamp: new Date().toISOString()
    });

    return {
      pagopa_id: Number(result.pagopa_id),
      riam_quater_id: Number(result.riam_quater_id),
      action: result.action,
      unlocked: Boolean(result.unlocked)
    };

  } catch (error) {
    console.error('Error unlinking PagoPA from RQ:', error);
    
    // Mappa errore per UX
    const userMessage = mapRqLinkError(error);
    const enhancedError = new Error(userMessage);
    (enhancedError as any).originalError = error;
    
    throw enhancedError;
  }
}

/**
 * Sblocca una PagoPA se non ha collegamenti residui (per casi legacy)
 */
export async function unlockPagopaIfNoLinks(pagopaId: number | string): Promise<boolean> {
  try {
    const validPagopaId = toIntId(pagopaId, 'pagopaId');

    const { data, error } = await supabase.rpc('pagopa_unlock_if_no_links', {
      p_pagopa_id: validPagopaId
    });

    if (error) throw error;

    return Boolean(data);

  } catch (error) {
    console.error('Error unlocking PagoPA:', error);
    throw mapRqLinkError(error);
  }
}

/**
 * Ottiene i collegamenti esistenti per una PagoPA
 */
export async function getPagopaLinks(pagopaId: number) {
  try {
    const { data, error } = await supabase
      .from('riam_quater_links')
      .select(`
        *,
        rq:riam_quater_id (
          id,
          number,
          taxpayer_name
        )
      `)
      .eq('pagopa_id', pagopaId);

    if (error) throw error;

    return data || [];

  } catch (error) {
    console.error('Error fetching PagoPA links:', error);
    throw error;
  }
}