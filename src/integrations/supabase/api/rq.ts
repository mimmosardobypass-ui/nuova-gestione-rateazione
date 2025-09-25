import { supabase } from '@/integrations/supabase/client';

export interface RqLight {
  id: number;
  number: string;
  taxpayer_name?: string | null;
  quater_total_due_cents?: number | null;
}

/**
 * RQ disponibili lato DB (esclude quelle già collegate alla PagoPA).
 * Fallback client-side se la RPC non è disponibile.
 */
export async function fetchSelectableRqForPagopa(
  pagopaId: number,
  allRq: RqLight[],
  linkedRqIds?: number[]
): Promise<RqLight[]> {
  try {
    const { data, error } = await supabase.rpc('get_rq_available_for_pagopa', {
      p_pagopa_id: pagopaId,
    });
    if (error) throw error;
    return (data ?? []).map(r => ({
      id: Number(r.id),
      number: String(r.number ?? ''),
      taxpayer_name: r.taxpayer_name ?? null,
      quater_total_due_cents: Number(r.quater_total_due_cents ?? 0),
    }));
  } catch (_e) {
    // Fallback: filtra client-side usando gli ID già collegati
    if (!linkedRqIds?.length) return allRq;
    const blocked = new Set(linkedRqIds);
    return allRq.filter(r => !blocked.has(Number(r.id)));
  }
}