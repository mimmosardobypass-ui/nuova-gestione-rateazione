// Centralized types for rateations feature

// F24 Decadence Management Types
export type RateationStatus = 'active' | 'decadence_pending' | 'decaduta';

export interface DecadenceInfo {
  decadence_at?: string | null;
  decadence_installment_id?: number | null;
  decadence_confirmed_by?: string | null;
  decadence_reason?: string | null;
  residual_at_decadence: number;
  transferred_amount: number;
  replaced_by_rateation_id?: number | null;
}

export interface RateationRow {
  id: string;
  numero: string;
  tipo: string;
  contribuente: string | null;
  importoTotale: number;
  importoPagato: number;
  importoRitardo: number;
  residuo: number;
  rateTotali: number;
  ratePagate: number;
  rateNonPagate: number;
  rateInRitardo: number;
  ratePaidLate: number; // NEW: rate pagate in ritardo
  // F24 Decadence fields
  is_f24?: boolean;
  status?: RateationStatus;
  decadence_info?: DecadenceInfo;
  // PagoPA "8 skips" rule fields 
  is_pagopa?: boolean;              // Derived from tipo field in DB view
  unpaid_overdue_today?: number;    // Rate non pagate con due_date < current_date
  unpaid_due_today?: number;        // Rate non pagate con due_date = current_date
  max_skips_effective?: number;     // Effective max skips (default 8)
  skip_remaining?: number;          // GREATEST(0, max_skips_effective - unpaid_overdue_today) 
  at_risk_decadence?: boolean;      // unpaid_overdue_today >= max_skips_effective
  // Debt migration fields
  debts_total?: number;             // Total number of linked debts
  debts_migrated?: number;          // Number of migrated debts
  migrated_debt_numbers?: string[]; // Array of migrated debt numbers
  remaining_debt_numbers?: string[]; // Array of remaining debt numbers
  rq_target_ids?: string[];         // Array of target rateation IDs (consistent string type)
  rq_migration_status?: 'none' | 'partial' | 'full'; // Migration status
  excluded_from_stats?: boolean;    // Exclude from global statistics
}

export interface DecadenceDashboard {
  gross_decayed: number;
  transferred: number;
  net_to_transfer: number;
}

// NEW: combined UI data structure
export interface DecadenceUIData {
  dashboard: DecadenceDashboard | null;
  preview_cents: number;     // potenziale in cents
}

export interface DecadenceDetail {
  id: number;
  number: string;
  taxpayer_name: string | null;
  decadence_at: string;
  residual_at_decadence: number;
  transferred_amount: number;
  to_transfer: number;
  replaced_by_rateation_id?: number | null;
}

export interface InstallmentUI {
  id: number;
  seq: number;
  amount: number;
  due_date: string;
  is_paid: boolean;
  paid_at: string | null;
  postponed: boolean;
  late_days?: number;
  status?: string;
  paid_recorded_at?: string | null;
  penalty_amount_cents?: number;
  interest_amount_cents?: number;
  paid_total_cents?: number;
  penalty_rule_id?: string;
  interest_breakdown?: Array<{
    from: string;
    to: string;
    days: number;
    annual_percent: number;
    amount_cents: number;
  }>;
  // New fields for clearer payment handling
  payment_mode?: 'ordinary' | 'ravvedimento' | 'partial';
  paid_date?: string | null;
  extra_interest_euro?: number;
  extra_penalty_euro?: number;
  // Decadence support
  effective_status?: 'paid' | 'overdue' | 'open' | 'decayed';
  rateation_status?: RateationStatus;
}

export interface RavvedimentoCalculation {
  late_days: number;
  penalty_amount_cents: number;
  interest_amount_cents: number;
  paid_total_cents: number;
  penalty_rule_id: string | null;
  interest_breakdown: Array<{
    from: string;
    to: string;
    days: number;
    annual_percent: number;
    amount_cents: number;
  }>;
}

export interface RateationType {
  id: number;
  name: string;
}

export interface ManualRow {
  amount: string;
  due: string;
}

export interface RateationFilters {
  tipo?: string;
  stato?: string;
  mese?: string;
  anno?: string;
}

// API Response types
export interface CreateRateationAutoParams {
  p_number: string;
  p_type_id: number;
  p_taxpayer_name: string | null;
  p_start_due_date: string;
  p_frequency: string;
  p_num_installments: number;
  p_amount_per_installment: number;
}

export interface CreateRateationManualParams {
  p_number: string;
  p_type_id: number;
  p_taxpayer_name: string | null;
  p_installments_json: Array<{ seq: number; amount: number; due_date: string }>;
}

// Debt Migration Types
export interface Debt {
  id: string;
  number: string;
  description?: string;
  original_amount_cents?: number;
}

export interface RateationDebt {
  rateation_id: number;
  debt_id: string;
  status: 'active' | 'migrated_out' | 'migrated_in';
  target_rateation_id?: number;
  migrated_at?: string;
  note?: string;
}

export interface MigrateDebtsParams {
  sourceRateationId: number;
  debtIds: string[];
  targetRateationId: number;
  note?: string;
}