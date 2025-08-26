import { supabase } from "@/integrations/supabase/client-resilient";
import { DecadenceDashboard, DecadenceDetail } from "../types";

// Fetch decadence dashboard data (converts from cents to euros)
export async function fetchDecadenceDashboard(signal?: AbortSignal): Promise<DecadenceDashboard> {
  if (!supabase) {
    throw new Error('Database non disponibile');
  }
  
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

/**
 * Legge la vista v_dashboard_decaduto e restituisce valori in euro.
 * - Se la vista restituisce N righe (per piano), le somma tutte.
 * - Se restituisce 1 riga aggregata, i totali restano invariati.
 */
export async function fetchDecadenceDashboardEuros(
  signal?: AbortSignal
): Promise<{
  netToTransferEuro: number;
  grossDecayedEuro: number;
  transferredEuro: number;
}> {
  if (!supabase) {
    return { netToTransferEuro: 0, grossDecayedEuro: 0, transferredEuro: 0 };
  }
  
  const { data, error } = await supabase
    .from("v_dashboard_decaduto")
    .select("gross_decayed_cents, transferred_cents, net_to_transfer_cents")
    .abortSignal(signal);

  if (error) {
    throw new Error(`fetchDecadenceDashboardEuros: ${error.message}`);
  }

  const rows = Array.isArray(data) ? data : data ? [data] : [];

  const agg = rows.reduce(
    (acc, r) => {
      acc.gross += Number(r?.gross_decayed_cents || 0);
      acc.trans += Number(r?.transferred_cents || 0);
      acc.net += Number(r?.net_to_transfer_cents || 0);
      return acc;
    },
    { gross: 0, trans: 0, net: 0 }
  );

  return {
    grossDecayedEuro: agg.gross / 100,
    transferredEuro: agg.trans / 100,
    netToTransferEuro: agg.net / 100,
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