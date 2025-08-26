import { supabase } from "@/integrations/supabase/client-resilient";
import type { CreateRateationAutoParams, CreateRateationManualParams, RateationType } from "../types";

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
    .eq("rateation_id", id);

  if (installmentsError) throw installmentsError;

  // Delete rateation
  const { error: rateationError } = await supabase
    .from("rateations")
    .delete()
    .eq("id", id);

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