import { supabase } from '@/integrations/supabase/client';
import { toIntId } from '@/lib/utils/ids'; // Only used by legacy linkPagopaToRQ/unlinkPagopaFromRQ

/**
 * FASE 3: Migrazione atomica PagoPA → RQ (FIX DEFINITIVO con JSON payload)
 * La PagoPA passa a INTERROTTA e i link vengono creati in unica transazione
 * Usa pagopa_link_rq_v2 per eliminare ogni ambiguità di casting
 */
export async function migratePagopaAttachRq(
  pagopaId: string | number,
  rqIds: (string | number)[],
  note?: string
) {
  // Validazione rigorosa - assicura che siano numeri sicuri
  const pagopaNum = Number(pagopaId);
  const rqIdsNum = rqIds.map((v) => Number(v));

  if (!Number.isSafeInteger(pagopaNum)) {
    throw new Error(`ID PagoPA non numerico passato alla migrazione: ${pagopaId}`);
  }
  const invalidRqIds = rqIds.filter((v, i) => !Number.isSafeInteger(rqIdsNum[i]));
  if (invalidRqIds.length > 0) {
    throw new Error(`ID RQ non numerici passati alla migrazione: ${invalidRqIds.join(', ')}`);
  }

  // Costruisci payload JSON con stringhe (zero cast impliciti)
  const payload = {
    pagopa_id: String(pagopaNum),
    rq_ids: rqIdsNum.map(String),
    note: note ?? null
  };

  // Debug logging per tracciare il payload JSON
  if (process.env.NODE_ENV !== 'production') {
    console.debug('[DBG/RPC] pagopa_link_rq_v2 payload:', payload);
  }

  const { data, error } = await supabase.rpc('pagopa_link_rq_v2', { payload });
  
  if (error) {
    console.error('Error in pagopa_link_rq_v2:', error);
    throw new Error(`Migrazione fallita: ${error.message}`);
  }
  
  return data ?? [];
}

/**
 * FASE 3: Sgancio atomico PagoPA ↔ RQ
 * Chiude i link specificati; se non restano link attivi, PagoPA torna ATTIVA
 */
export async function undoPagopaLinks(
  pagopaId: string | number,
  rqIds?: (string | number)[]
) {
  const { data, error } = await supabase.rpc('pagopa_unlink_rq', {
    p_pagopa_id: toIntId(pagopaId, 'pagopaId'),
    p_rq_ids: rqIds?.map(id => toIntId(id, 'rqId')) ?? null
  });
  
  if (error) {
    console.error('Error in pagopa_unlink_rq:', error);
    throw new Error(`Sgancio fallito: ${error.message}`);
  }
  
  // Returns true if PagoPA was unlocked (no more active links)
  return Boolean(data);
}

/**
 * LEGACY: Ottiene i collegamenti esistenti per una PagoPA (solo link attivi)
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
      .eq('pagopa_id', pagopaId)
      .is('unlinked_at', null); // Solo link attivi

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching PagoPA links:', error);
    throw error;
  }
}

/**
 * DEPRECATED: Funzioni legacy per compatibilità con RqAllocationForm
 * Queste funzioni usano ancora il vecchio sistema di allocazione per quote
 */

export interface RqLinkResult {
  pagopa_id: number;
  riam_quater_id: number;
  allocated_residual_cents: number;
  reason?: string;
  action: 'created' | 'updated';
}

/**
 * @deprecated Use migratePagopaAttachRq instead for new code
 */
export async function linkPagopaToRQ(
  pagopaId: number | string, 
  rqId: number | string, 
  allocatedCents: number,
  note?: string
): Promise<RqLinkResult> {
  try {
    const validPagopaId = toIntId(pagopaId, 'pagopaId');
    const validRqId = toIntId(rqId, 'rqId');
    
    if (!Number.isInteger(allocatedCents) || allocatedCents <= 0) {
      throw new Error('INVALID_QUOTA: Allocated quota must be an integer > 0');
    }

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
    
    console.log('RQ allocation success:', {
      pagopaId: validPagopaId,
      rqId: validRqId,
      allocatedCents,
      action: result.action,
      timestamp: new Date().toISOString()
    });

    return {
      pagopa_id: Number(result.pagopa_id),
      riam_quater_id: Number(result.riam_quater_id),
      allocated_residual_cents: Number(result.allocated_residual_cents),
      reason: result.reason || undefined,
      action: result.action as 'created' | 'updated'
    };

  } catch (error) {
    console.error('Error linking PagoPA to RQ:', error);
    const userMessage = mapRqLinkError(error);
    const enhancedError = new Error(userMessage);
    (enhancedError as any).originalError = error;
    throw enhancedError;
  }
}

/**
 * @deprecated Use undoPagopaLinks instead for new code
 */
export async function unlinkPagopaFromRQ(
  pagopaId: number | string, 
  rqId: number | string,
  note?: string
): Promise<{ pagopa_id: number; riam_quater_id: number; action: string; unlocked: boolean }> {
  try {
    const validPagopaId = toIntId(pagopaId, 'pagopaId');
    const validRqId = toIntId(rqId, 'rqId');

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
    const userMessage = mapRqLinkError(error);
    const enhancedError = new Error(userMessage);
    (enhancedError as any).originalError = error;
    throw enhancedError;
  }
}

/**
 * Mappatura errori DB → messaggi utente
 */
export function mapRqLinkError(error: any): string {
  const errorMessage = error?.message || String(error);
  
  if (errorMessage.includes('INVALID_QUOTA:')) {
    return 'La quota deve essere maggiore di zero';
  }
  if (errorMessage.includes('PAGOPA_ACCESS_DENIED:') || errorMessage.includes('Access denied to PagoPA')) {
    return 'Piano PagoPA non trovato o accesso negato';
  }
  if (errorMessage.includes('RQ_ACCESS_DENIED:') || errorMessage.includes('Access denied to RQ')) {
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
  
  if (errorMessage.includes('access denied') || errorMessage.includes('not found')) {
    return 'Accesso negato o piano non trovato';
  }
  
  return 'Errore durante il collegamento. Riprovare o contattare il supporto.';
}
