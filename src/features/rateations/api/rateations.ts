import { supabase } from "@/integrations/supabase/client-resilient";
import type { CreateRateationAutoParams, CreateRateationManualParams, RateationType } from "../types";
import { toIntId } from "@/lib/utils/ids";

// LOVABLE:START fetchRateations
export const fetchRateations = async (signal?: AbortSignal) => {
  if (signal?.aborted) throw new Error('AbortError');
  
  const { data: rateations, error: rateationsError } = await supabase
    .from("rateations")
    .select("*");

  if (signal?.aborted) throw new Error('AbortError');
  if (rateationsError) throw rateationsError;

  const { data: installments, error: installmentsError } = await supabase
    .from("installments")
    .select("*");

  if (signal?.aborted) throw new Error('AbortError');
  if (installmentsError) throw installmentsError;

  const { data: types, error: typesError } = await supabase
    .from("rateation_types")
    .select("*");

  if (signal?.aborted) throw new Error('AbortError');
  if (typesError) throw typesError;

  return { rateations, installments, types };
};
// LOVABLE:END fetchRateations

// LOVABLE:START fetchRateationTypes
export const fetchRateationTypes = async (signal?: AbortSignal): Promise<RateationType[]> => {
  if (signal?.aborted) throw new Error('AbortError');
  
  const { data, error } = await supabase
    .from("rateation_types")
    .select("id, name")
    .order("name");

  if (signal?.aborted) throw new Error('AbortError');
  if (error) throw error;
  return data || [];
};
// LOVABLE:END fetchRateationTypes

// LOVABLE:START createRateationAuto
export const createRateationAuto = async (params: CreateRateationAutoParams): Promise<number> => {
  const { data, error } = await supabase.rpc("fn_create_rateation_auto", params);

  if (error) throw error;
  return data;
};
// LOVABLE:END createRateationAuto

// LOVABLE:START createRateationManual
export const createRateationManual = async (params: CreateRateationManualParams): Promise<number> => {
  const { data, error } = await supabase.rpc("fn_create_rateation_manual", params);

  if (error) throw error;
  return data;
};
// LOVABLE:END createRateationManual

// LOVABLE:START addRateationType
export const addRateationType = async (name: string): Promise<RateationType> => {
  const { data, error } = await supabase
    .from("rateation_types")
    .insert({ name })
    .select("id, name")
    .single();

  if (error) throw error;
  return data;
};
// LOVABLE:END addRateationType

// LOVABLE:START deleteRateation
export const deleteRateation = async (id: string): Promise<void> => {
  // Delete installments first
  const { error: installmentsError } = await supabase
    .from("installments")
    .delete()
    .eq("rateation_id", toIntId(id, 'rateationId'));

  if (installmentsError) throw installmentsError;

  // Delete rateation
  const { error: rateationError } = await supabase
    .from("rateations")
    .delete()
    .eq("id", toIntId(id, 'rateationId'));

  if (rateationError) throw rateationError;
};
// LOVABLE:END deleteRateation

// LOVABLE:START fetchSingleRateation
export const fetchSingleRateation = async (id: string, signal?: AbortSignal) => {
  if (signal?.aborted) throw new Error('AbortError');
  
  const { data, error } = await supabase
    .from("rateations")
    .select("*")
    .eq("id", id)
    .single();

  if (signal?.aborted) throw new Error('AbortError');
  if (error) throw error;
  return data;
};
// LOVABLE:END fetchSingleRateation

// LOVABLE:START updateRateation
export const updateRateation = async (id: string, updates: any) => {
  const { error } = await supabase
    .from("rateations")
    .update(updates)
    .eq("id", id);

  if (error) throw error;
};
// LOVABLE:END updateRateation

// LOVABLE:START markPagopaInterrupted
export const markPagopaInterrupted = async (
  pagopaId: string,
  riamQuaterId: string,
  reason?: string
): Promise<void> => {
  const todayIso = new Date().toISOString().slice(0, 10); // yyyy-mm-dd

  // 1) Update PagoPA -> stato "INTERROTTA" + link a Riam.Quater
  const { error: updateError } = await supabase
    .from("rateations")
    .update({
      status: 'INTERROTTA',
      interrupted_at: todayIso,
      interruption_reason: reason ?? 'Interrotta per Riammissione Quater',
      interrupted_by_rateation_id: riamQuaterId
    })
    .eq('id', pagopaId);

  if (updateError) throw updateError;

  // 2) Upsert del collegamento nella tabella ponte
  const { error: linkError } = await supabase
    .from('riam_quater_links')
    .upsert(
      { 
        riam_quater_id: riamQuaterId, 
        pagopa_id: pagopaId 
      },
      { 
        onConflict: 'riam_quater_id,pagopa_id' 
      }
    );

  if (linkError) throw linkError;
};
// LOVABLE:END markPagopaInterrupted

// LOVABLE:START getPagopaLinkedToRiam
export const getPagopaLinkedToRiam = async (riamQuaterId: string) => {
  const { data: links, error: linkErr } = await supabase
    .from('riam_quater_links')
    .select('pagopa_id')
    .eq('riam_quater_id', riamQuaterId);

  if (linkErr) throw linkErr;

  const ids = (links ?? []).map(l => l.pagopa_id);
  if (!ids.length) return [];

  const { data: rateations, error: rErr } = await supabase
    .from('rateations')
    .select('id, number, taxpayer_name, total_amount, status, interrupted_by_rateation_id')
    .in('id', ids);

  if (rErr) throw rErr;
  return rateations ?? [];
};
// LOVABLE:END getPagopaLinkedToRiam

// LOVABLE:START unlinkPagopaFromRiam
export const unlinkPagopaFromRiam = async (
  pagopaId: string,
  riamQuaterId: string
): Promise<void> => {
  // 1) Rimuovi lo stato di interruzione dalla PagoPA
  const { error: updateError } = await supabase
    .from("rateations")
    .update({
      status: 'ATTIVA',
      interrupted_at: null,
      interruption_reason: null,
      interrupted_by_rateation_id: null
    })
    .eq('id', pagopaId);

  if (updateError) throw updateError;

  // 2) Rimuovi il collegamento
  const { error: linkError } = await supabase
    .from('riam_quater_links')
    .delete()
    .eq('riam_quater_id', riamQuaterId)
    .eq('pagopa_id', pagopaId);

  if (linkError) throw linkError;
};
// LOVABLE:END unlinkPagopaFromRiam

// LOVABLE:START getRiamQuaterOptions
export const getRiamQuaterOptions = async (): Promise<
  { id: string; number: string | null; taxpayer_name: string | null }[]
> => {
  const { data, error } = await supabase
    .from("rateation_types")
    .select("id, name")
    .eq("name", "Riam.Quater");

  if (error) throw error;
  
  if (!data || data.length === 0) {
    return [];
  }

  const riamQuaterTypeId = data[0].id;

  const { data: rateations, error: rateationsError } = await supabase
    .from("rateations")
    .select("id, number, taxpayer_name")
    .eq("type_id", riamQuaterTypeId)
    .order("created_at", { ascending: false });

  if (rateationsError) throw rateationsError;
  
  return (rateations || []) as { id: string; number: string | null; taxpayer_name: string | null }[];
};
// LOVABLE:END getRiamQuaterOptions