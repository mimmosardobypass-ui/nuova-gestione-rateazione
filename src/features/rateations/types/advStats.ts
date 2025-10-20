/**
 * Types for Advanced Statistics V2
 */

export type CanonicalType = 'F24' | 'PAGOPA' | 'ROTTAMAZIONE_QUATER' | 'RIAMMISSIONE_QUATER' | 'ALTRO';

export interface AdvStatsFilters {
  startDate: string | null;  // 'YYYY-MM-DD' | null
  endDate: string | null;    // 'YYYY-MM-DD' | null
  typeLabels: string[] | null; // se null ⇒ tutti; se 1+ ⇒ SOLO quelli
  statuses: string[] | null;   // lowercase preferibile
  taxpayerSearch: string | null;
  ownerOnly: boolean;
  includeClosed: boolean;
  groupBy: 'ref' | 'created';  // ref = due_date, created = created_at
}

export interface AdvStatsKPI {
  total_amount_cents: number;
  residual_amount_cents: number;
  paid_amount_cents: number;
}

export interface AdvStatsByType {
  type_label: string;
  total_amount_cents: number;
}

export interface AdvStatsByStatus {
  status: string;
  count: number;
}

export interface AdvStatsByTaxpayer {
  taxpayer_name: string | null;
  amount_cents: number;
  count: number;
}

export interface AdvStatsMonthlyPoint {
  month: string; // 'YYYY-MM'
  type_label: string | null;
  total_amount_cents: number;
}

export interface AdvStatsPayload {
  meta: {
    version: string;
    group_by: string;
    generated_at: string;
  };
  inputs_echo: any;
  kpi: AdvStatsKPI;
  by_type: AdvStatsByType[];
  by_status: AdvStatsByStatus[];
  by_taxpayer: AdvStatsByTaxpayer[];
  top_taxpayers: AdvStatsByTaxpayer[];
  series_monthly: AdvStatsMonthlyPoint[];
  errors: string[];
}
