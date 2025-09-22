import { supabase } from "@/integrations/supabase/client";
import type { RQLinkedTaxpayers, RQSavingDetail, RQSavingAgg } from "../types/risparmio";

/**
 * API per i dati del Report Risparmio Riammissione Quater
 */

export async function getRQLinkedTaxpayers(rqId?: string): Promise<RQLinkedTaxpayers[]> {
  let query = supabase
    .from('v_rq_contribuenti_aggregati')
    .select('*');

  if (rqId) {
    const numericId = parseInt(rqId, 10);
    query = query.eq('riam_quater_id', numericId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching RQ linked taxpayers:', error);
    throw error;
  }

  return (data || []).map(item => ({
    ...item,
    riam_quater_id: item.riam_quater_id.toString()
  }));
}

export async function getRQRisparmioDettaglio(rqId?: string): Promise<RQSavingDetail[]> {
  let query = supabase
    .from('v_risparmio_riam_quater')
    .select('*');

  if (rqId) {
    const numericId = parseInt(rqId, 10);
    query = query.eq('riam_quater_id', numericId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching RQ risparmio dettaglio:', error);
    throw error;
  }

  return (data || []).map(item => ({
    ...item,
    riam_quater_id: item.riam_quater_id.toString(),
    pagopa_id: item.pagopa_id.toString()
  }));
}

export async function getRQRisparmioAggregato(rqId?: string): Promise<RQSavingAgg[]> {
  let query = supabase
    .from('v_risparmio_riam_quater_aggregato')
    .select('*');

  if (rqId) {
    const numericId = parseInt(rqId, 10);
    query = query.eq('riam_quater_id', numericId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching RQ risparmio aggregato:', error);
    throw error;
  }

  return (data || []).map(item => ({
    ...item,
    riam_quater_id: item.riam_quater_id.toString()
  }));
}