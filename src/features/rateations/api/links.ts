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
    .order("linked_at", { ascending: false }); // collegamenti più recenti prima

  if (error) {
    console.error("Error fetching PagoPA links:", error);
    throw error;
  }

  return (data ?? []) as PagopaLinkRow[];
}