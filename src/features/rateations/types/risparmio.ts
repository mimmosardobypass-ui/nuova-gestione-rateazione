/**
 * Tipi per il Report Risparmio Riammissione Quater
 */

export interface RQLinkedTaxpayers {
  riam_quater_id: string;
  rq_number: string | null;
  rq_taxpayer: string | null;
  linked_taxpayers: string;
}

export interface RQSavingDetail {
  riam_quater_id: string;
  rq_number: string | null;
  rq_taxpayer: string | null;
  pagopa_id: string;
  pagopa_number: string | null;
  pagopa_taxpayer: string | null;
  residuo_pagopa: number;
  totale_rq: number;
  risparmio_stimato: number;
}

export interface RQSavingAgg {
  riam_quater_id: string;
  rq_number: string | null;
  rq_taxpayer: string | null;
  residuo_pagopa_tot: number;
  totale_rq: number;
  risparmio_stimato_tot: number;
}