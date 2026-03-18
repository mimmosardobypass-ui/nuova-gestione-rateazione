import { supabase } from "@/integrations/supabase/client";

export interface PagopaLinkRow {
  pagopa_id: number;
  pagopa_number: string | null;
  pagopa_taxpayer: string | null;
  riam_quater_id: number;
  rq_number: string | null;
  rq_taxpayer: string | null;
  linked_at: string;
  note: string | null;
  residuo_pagopa_at_link_cents: number;
  totale_rq_at_link_cents: number;
  risparmio_at_link_cents: number;
}

/**
 * Recupera tutti i collegamenti RQ per una PagoPA specifica
 * Utilizza la vista v_pagopa_linked_rq che contiene snapshot immutabili
 */
export async function getLinksForPagopa(pagopaId: number): Promise<PagopaLinkRow[]> {
  const { data, error } = await supabase
    .from("v_pagopa_linked_rq")
    .select("*")
    .eq("pagopa_id", pagopaId)
    .order("linked_at", { ascending: false });

  if (error) {
    console.error("Error fetching PagoPA links:", error);
    throw error;
  }

  return (data ?? []) as PagopaLinkRow[];
}

export interface QuinquiesLinkRow {
  id: string;
  pagopa_id: number;
  quinquies_id: number;
  r5_number: string | null;
  pagopa_taxpayer_at_link: string | null;
  quinquies_taxpayer_at_link: string | null;
  pagopa_residual_at_link_cents: number | null;
  quinquies_total_at_link_cents: number | null;
  risparmio_at_link_cents: number | null;
  allocated_residual_cents: number | null;
  reason: string | null;
  created_at: string;
}

/**
 * Recupera i collegamenti R5 (Rottamazione Quinquies) per una PagoPA specifica
 */
export async function getR5LinksForPagopa(pagopaId: number): Promise<QuinquiesLinkRow[]> {
  const { data, error } = await supabase
    .from("quinquies_links")
    .select(`
      id,
      pagopa_id,
      quinquies_id,
      pagopa_taxpayer_at_link,
      quinquies_taxpayer_at_link,
      pagopa_residual_at_link_cents,
      quinquies_total_at_link_cents,
      risparmio_at_link_cents,
      allocated_residual_cents,
      reason,
      created_at
    `)
    .eq("pagopa_id", pagopaId)
    .is("unlinked_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching R5 links:", error);
    throw error;
  }

  // Fetch R5 numbers from rateations table
  const rows = (data ?? []) as any[];
  if (rows.length === 0) return [];

  const r5Ids = [...new Set(rows.map(r => r.quinquies_id))];
  const { data: rateations } = await supabase
    .from("rateations")
    .select("id, number")
    .in("id", r5Ids);

  const numberMap = new Map((rateations ?? []).map(r => [r.id, r.number]));

  return rows.map(r => ({
    ...r,
    r5_number: numberMap.get(r.quinquies_id) ?? null,
  }));
}