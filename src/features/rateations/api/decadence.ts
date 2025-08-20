import { supabase } from "@/integrations/supabase/client";
import { DecadenceDashboard, DecadenceDetail } from "../types";

// Fetch decadence dashboard data (converts from cents to euros)
export async function fetchDecadenceDashboard(signal?: AbortSignal): Promise<DecadenceDashboard> {
  const { data, error } = await supabase
    .from('v_dashboard_decaduto')
    .select('gross_decayed_cents, transferred_cents, net_to_transfer_cents')
    .abortSignal(signal)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch decadence dashboard: ${error.message}`);
  }

  return {
    gross_decayed: (data?.gross_decayed_cents ?? 0) / 100,
    transferred: (data?.transferred_cents ?? 0) / 100,
    net_to_transfer: (data?.net_to_transfer_cents ?? 0) / 100,
  };
}

// Fetch decadence details
export async function fetchDecadenceDetails(signal?: AbortSignal): Promise<DecadenceDetail[]> {
  const { data, error } = await supabase
    .from('v_decadute_dettaglio')
    .select('*')
    .abortSignal(signal);

  if (error) {
    throw new Error(`Failed to fetch decadence details: ${error.message}`);
  }

  return data || [];
}

// Auto-flag pre-decadence plans
export async function autoFlagPreDecadence(): Promise<void> {
  const { error } = await supabase.rpc('rateation_auto_flag_predecadence');

  if (error) {
    throw new Error(`Failed to auto-flag pre-decadence: ${error.message}`);
  }
}

// Confirm decadence manually
export async function confirmDecadence(
  rateationId: number,
  installmentId: number,
  reason?: string
): Promise<void> {
  const { error } = await supabase.rpc('rateation_confirm_decadence', {
    p_rateation_id: rateationId,
    p_installment_id: installmentId,
    p_reason: reason || null
  });

  if (error) {
    throw new Error(`Failed to confirm decadence: ${error.message}`);
  }
}

// Fetch decadence preview (potential non-confirmed)
export async function fetchDecadencePreview(signal?: AbortSignal): Promise<number> {
  const { data, error } = await supabase
    .from('v_dashboard_decaduto_preview')
    .select('potential_gross_decayed_cents')
    .abortSignal(signal)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch decadence preview: ${error.message}`);
  }
  return data?.potential_gross_decayed_cents || 0;
}

// Link transfer from F24 to PagoPA
export async function linkTransfer(
  f24Id: number,
  pagopaId: number,
  amount: number
): Promise<void> {
  const { error } = await supabase.rpc('rateation_link_transfer', {
    p_f24_id: f24Id,
    p_pagopa_id: pagopaId,
    p_amount: amount
  });

  if (error) {
    throw new Error(`Failed to link transfer: ${error.message}`);
  }
}