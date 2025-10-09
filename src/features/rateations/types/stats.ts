/**
 * Types for Statistics Dashboard
 */

export interface StatsFilters {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  typeLabels: string[] | null; // ['F24', 'PagoPA', ...] or null for all
  statuses: string[] | null; // ['attiva', 'INTERROTTA', ...] or null for all
  taxpayerSearch: string | null;
  ownerOnly: boolean;
  includeClosed: boolean; // Se true, include anche 'INTERROTTA' e 'ESTINTA'
}

export interface StatsByType {
  type_label: string;
  count: number;
  total_amount_cents: number;
  paid_amount_cents: number;
  residual_amount_cents: number;
  overdue_amount_cents: number;
}

export interface StatsByStatus {
  status: string;
  count: number;
  total_amount_cents: number;
  paid_amount_cents: number;
  residual_amount_cents: number;
  overdue_amount_cents: number;
}

export interface StatsByTaxpayer {
  taxpayer_name: string;
  count: number;
  total_amount_cents: number;
  paid_amount_cents: number;
  residual_amount_cents: number;
  overdue_amount_cents: number;
}

export interface StatsCashflowMonthly {
  month: string; // YYYY-MM-DD
  installments_count: number;
  due_amount_cents: number;
  paid_amount_cents: number;
  unpaid_amount_cents: number;
  overdue_amount_cents: number;
}

export interface FilteredStats {
  by_type: StatsByType[];
  by_status: StatsByStatus[];
  by_taxpayer: StatsByTaxpayer[];
  cashflow: StatsCashflowMonthly[];
}

export interface StatsKPIs {
  residual_total: number; // EUR
  paid_total: number; // EUR
  overdue_total: number; // EUR
  quater_saving: number; // EUR
}

export interface CollapsedSections {
  kpis: boolean;
  charts: boolean;
  tables: boolean;
  residualDetail: boolean;
}

export interface ResidualDetailRow {
  id: number;
  number: string;
  taxpayer_name: string | null;
  type_label: string;
  status: string;
  created_at: string;
  residual_amount_cents: number;
}

export interface ResidualDetailPrefs {
  groupByType: boolean;
}
