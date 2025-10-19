import { supabase } from "@/integrations/supabase/client";
import { toIntId } from "@/lib/utils/ids";

export interface F24LinkResult {
  link_id: string;
  f24_id: number;
  pagopa_id: number;
  maggiorazione_cents: number;
  action: 'created' | 'updated';
}

export interface F24PagopaLink {
  link_id: string;
  f24_id: number;
  f24_number: string;
  f24_taxpayer: string | null;
  pagopa_id: number;
  pagopa_number: string;
  pagopa_taxpayer: string | null;
  snapshot_f24_residual_cents: number;
  pagopa_total_cents: number;
  maggiorazione_allocata_cents: number;
  linked_at: string;
  reason: string | null;
}

export interface PagopaOption {
  id: number;
  number: string;
  taxpayer_name: string | null;
  pagopa_total_cents: number;
}

/**
 * Collega un F24 decaduto a una PagoPA atomicamente
 * Calcola automaticamente residuo F24, totale PagoPA e maggiorazione
 */
export async function linkF24ToPagopa(
  f24Id: number,
  pagopaId: number,
  reason?: string
): Promise<F24LinkResult> {
  const { data, error } = await supabase.rpc('link_f24_to_pagopa_atomic', {
    p_f24_id: toIntId(f24Id, 'f24_id'),
    p_pagopa_id: toIntId(pagopaId, 'pagopa_id'),
    p_reason: reason || null
  });

  if (error) {
    console.error('[API] linkF24ToPagopa error:', error);
    throw new Error(mapF24LinkError(error));
  }

  if (!data || !data[0]) {
    throw new Error('Nessun risultato dalla RPC link_f24_to_pagopa_atomic');
  }

  return data[0] as F24LinkResult;
}

/**
 * Scollega un F24 dalla PagoPA collegata
 * Ripristina automaticamente F24 allo stato ATTIVA
 */
export async function unlinkF24FromPagopa(
  f24Id: number,
  reason?: string
): Promise<{ f24_restored: boolean }> {
  const { data, error } = await supabase.rpc('unlink_f24_from_pagopa', {
    p_f24_id: toIntId(f24Id, 'f24_id'),
    p_reason: reason || null
  });

  if (error) {
    console.error('[API] unlinkF24FromPagopa error:', error);
    throw new Error(mapF24LinkError(error));
  }

  if (!data || !data[0]) {
    throw new Error('Nessun risultato dalla RPC unlink_f24_from_pagopa');
  }

  return { f24_restored: data[0].f24_restored };
}

/**
 * Recupera PagoPA disponibili per collegamento a un F24
 * Esclude PagoPA già interrotte, estinte o decadute
 */
export async function getPagopaOptionsForF24(f24Id: number): Promise<PagopaOption[]> {
  const { data, error } = await supabase.rpc('get_pagopa_available_for_f24', {
    p_f24_id: toIntId(f24Id, 'f24_id')
  });

  if (error) {
    console.error('[API] getPagopaOptionsForF24 error:', error);
    throw error;
  }

  return (data || []) as PagopaOption[];
}

/**
 * Recupera il collegamento F24→PagoPA esistente per un F24
 */
export async function getF24Link(f24Id: number): Promise<F24PagopaLink | null> {
  const { data, error } = await supabase
    .from('v_f24_pagopa_maggiorazione')
    .select('*')
    .eq('f24_id', f24Id)
    .maybeSingle();

  if (error) {
    console.error('[API] getF24Link error:', error);
    throw error;
  }

  return data as F24PagopaLink | null;
}

/**
 * Mappa errori database a messaggi user-friendly
 */
function mapF24LinkError(error: any): string {
  const msg = error.message || String(error);
  
  if (msg.includes('F24_ACCESS_DENIED')) {
    return 'F24 non trovato o accesso negato';
  }
  if (msg.includes('PAGOPA_ACCESS_DENIED')) {
    return 'PagoPA non trovata o accesso negato';
  }
  if (msg.includes('uq_f24_single_active_link')) {
    return 'Questo F24 è già collegato a una PagoPA. Scollega prima il collegamento esistente.';
  }
  
  return msg;
}
