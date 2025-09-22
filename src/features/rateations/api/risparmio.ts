import { supabase } from "@/integrations/supabase/client";
import type { RQLinkedTaxpayers, RQSavingDetail, RQSavingAgg } from "../types/risparmio";

/**
 * API per i dati del Report Risparmio Riammissione Quater
 */

export async function getRQLinkedTaxpayers(rqId?: string | number): Promise<RQLinkedTaxpayers[]> {
  let query = supabase
    .from('v_rq_contribuenti_aggregati')
    .select('*');

  if (rqId) {
    const id = typeof rqId === 'string' ? parseInt(rqId) : rqId;
    query = query.eq('riam_quater_id', id);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching RQ linked taxpayers:', error);
    throw error;
  }

  return data || [];
}

export async function getRQRisparmioDettaglio(rqId?: string | number): Promise<RQSavingDetail[]> {
  let query = supabase
    .from('v_risparmio_riam_quater')
    .select('*');

  if (rqId) {
    const id = typeof rqId === 'string' ? parseInt(rqId) : rqId;
    query = query.eq('riam_quater_id', id);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching RQ risparmio dettaglio:', error);
    throw error;
  }

  return data || [];
}

export async function getRQRisparmioAggregato(rqId?: string | number): Promise<RQSavingAgg[]> {
  let query = supabase
    .from('v_risparmio_riam_quater_aggregato')
    .select('*');

  if (rqId) {
    const id = typeof rqId === 'string' ? parseInt(rqId) : rqId;
    query = query.eq('riam_quater_id', id);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching RQ risparmio aggregato:', error);
    throw error;
  }

  return data || [];
}