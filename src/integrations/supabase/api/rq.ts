import { supabase } from '@/integrations/supabase/client';

export interface RqLight {
  id: number;
  number: string;
  taxpayer_name?: string | null;
  quater_total_due_cents?: number | null;
}

export interface PagopaQuotaInfo {
  residualCents: number;
  allocatedCents: number;
  allocatableCents: number;
}

/**
 * FASE 2.1: Quota allocabile dalla RPC robusta (SECURITY DEFINER, filtra per owner)
 */
export async function fetchPagopaQuotaInfo(pagopaId: number): Promise<PagopaQuotaInfo> {
  const { data, error } = await supabase.rpc('pagopa_quota_info', { p_pagopa_id: pagopaId });
  if (error) throw error;
  const row = data?.[0] ?? { residual_cents: 0, allocated_cents: 0, allocatable_cents: 0 };
  return {
    residualCents: Number(row.residual_cents || 0),
    allocatedCents: Number(row.allocated_cents || 0),
    allocatableCents: Number(row.allocatable_cents || 0),
  };
}

/**
 * FASE 2.2: RQ disponibili dalla RPC robusta (SECURITY DEFINER, filtra per owner)
 * RQ disponibili lato DB - esclude quelle già collegate e filtra per owner della PagoPA.
 * Fallback client-side se la RPC non è disponibile.
 */
export async function fetchSelectableRqForPagopa(
  pagopaId: number,
  fallbackAllRq: RqLight[],
  linkedRqIds: number[]
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
    // Fallback: escludi client-side le RQ già collegate
    const blocked = new Set(linkedRqIds);
    return fallbackAllRq.filter(r => !blocked.has(Number(r.id)));
  }
}