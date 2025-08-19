// Centralized types for rateations feature

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