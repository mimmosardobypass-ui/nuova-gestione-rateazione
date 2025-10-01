export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      debts: {
        Row: {
          created_at: string
          description: string | null
          id: string
          number: string
          original_amount_cents: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          number: string
          original_amount_cents?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          number?: string
          original_amount_cents?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      installment_payments: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          installment_id: number
          kind: string
          note: string | null
          paid_date: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          installment_id: number
          kind: string
          note?: string | null
          paid_date: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          installment_id?: number
          kind?: string
          note?: string | null
          paid_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "installment_payments_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installment_payments_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "v_installments_effective"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installment_payments_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "v_installments_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installment_payments_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "v_rateation_installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installment_payments_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "v_rateations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installment_payments_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "v_scadenze"
            referencedColumns: ["id"]
          },
        ]
      }
      installments: {
        Row: {
          amount: number
          amount_cents: number | null
          apply_ravvedimento: boolean | null
          canceled_at: string | null
          created_at: string | null
          due_date: string
          extra_interest_euro: number | null
          extra_penalty_euro: number | null
          id: number
          interest_amount_cents: number | null
          interest_breakdown: Json | null
          is_paid: boolean | null
          late_days: number | null
          notes: string | null
          owner_uid: string
          paid_at: string | null
          paid_date: string | null
          paid_recorded_at: string | null
          paid_total_cents: number | null
          payment_method: string | null
          payment_mode: string | null
          penalty_amount_cents: number | null
          penalty_rule_id: string | null
          postponed: boolean | null
          rateation_id: number
          receipt_url: string | null
          seq: number
          status: string | null
        }
        Insert: {
          amount: number
          amount_cents?: number | null
          apply_ravvedimento?: boolean | null
          canceled_at?: string | null
          created_at?: string | null
          due_date: string
          extra_interest_euro?: number | null
          extra_penalty_euro?: number | null
          id?: number
          interest_amount_cents?: number | null
          interest_breakdown?: Json | null
          is_paid?: boolean | null
          late_days?: number | null
          notes?: string | null
          owner_uid: string
          paid_at?: string | null
          paid_date?: string | null
          paid_recorded_at?: string | null
          paid_total_cents?: number | null
          payment_method?: string | null
          payment_mode?: string | null
          penalty_amount_cents?: number | null
          penalty_rule_id?: string | null
          postponed?: boolean | null
          rateation_id: number
          receipt_url?: string | null
          seq: number
          status?: string | null
        }
        Update: {
          amount?: number
          amount_cents?: number | null
          apply_ravvedimento?: boolean | null
          canceled_at?: string | null
          created_at?: string | null
          due_date?: string
          extra_interest_euro?: number | null
          extra_penalty_euro?: number | null
          id?: number
          interest_amount_cents?: number | null
          interest_breakdown?: Json | null
          is_paid?: boolean | null
          late_days?: number | null
          notes?: string | null
          owner_uid?: string
          paid_at?: string | null
          paid_date?: string | null
          paid_recorded_at?: string | null
          paid_total_cents?: number | null
          payment_method?: string | null
          payment_mode?: string | null
          penalty_amount_cents?: number | null
          penalty_rule_id?: string | null
          postponed?: boolean | null
          rateation_id?: number
          receipt_url?: string | null
          seq?: number
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "rateations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_decadute_dettaglio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_migrable_pagopa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_pagopa_allocations"
            referencedColumns: ["pagopa_id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_pagopa_today_kpis"
            referencedColumns: ["rateation_id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_pagopa_unpaid_today"
            referencedColumns: ["rateation_id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rateation_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_list_ui"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_summary"
            referencedColumns: ["rateation_id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_summary_enhanced"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_with_kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rq_allocations"
            referencedColumns: ["rq_id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rq_contribuenti_aggregati"
            referencedColumns: ["riam_quater_id"]
          },
        ]
      }
      legal_interest_rates: {
        Row: {
          annual_rate_percent: number
          id: string
          valid_from: string
          valid_to: string
        }
        Insert: {
          annual_rate_percent: number
          id?: string
          valid_from: string
          valid_to: string
        }
        Update: {
          annual_rate_percent?: number
          id?: string
          valid_from?: string
          valid_to?: string
        }
        Relationships: []
      }
      pdf_import_profiles: {
        Row: {
          column_mappings: Json
          created_at: string
          description: string | null
          id: string
          name: string
          owner_uid: string
          updated_at: string
        }
        Insert: {
          column_mappings?: Json
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_uid: string
          updated_at?: string
        }
        Update: {
          column_mappings?: Json
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_uid?: string
          updated_at?: string
        }
        Relationships: []
      }
      rateation_debts: {
        Row: {
          created_at: string
          debt_id: string
          migrated_at: string | null
          note: string | null
          rateation_id: number
          status: string
          target_rateation_id: number | null
        }
        Insert: {
          created_at?: string
          debt_id: string
          migrated_at?: string | null
          note?: string | null
          rateation_id: number
          status: string
          target_rateation_id?: number | null
        }
        Update: {
          created_at?: string
          debt_id?: string
          migrated_at?: string | null
          note?: string | null
          rateation_id?: number
          status?: string
          target_rateation_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rateation_debts_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateation_debts_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "rateations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateation_debts_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_decadute_dettaglio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateation_debts_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_migrable_pagopa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateation_debts_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_pagopa_allocations"
            referencedColumns: ["pagopa_id"]
          },
          {
            foreignKeyName: "rateation_debts_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_pagopa_today_kpis"
            referencedColumns: ["rateation_id"]
          },
          {
            foreignKeyName: "rateation_debts_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_pagopa_unpaid_today"
            referencedColumns: ["rateation_id"]
          },
          {
            foreignKeyName: "rateation_debts_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rateation_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateation_debts_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_list_ui"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateation_debts_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_summary"
            referencedColumns: ["rateation_id"]
          },
          {
            foreignKeyName: "rateation_debts_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_summary_enhanced"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateation_debts_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_with_kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateation_debts_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rq_allocations"
            referencedColumns: ["rq_id"]
          },
          {
            foreignKeyName: "rateation_debts_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rq_contribuenti_aggregati"
            referencedColumns: ["riam_quater_id"]
          },
          {
            foreignKeyName: "rateation_debts_target_rateation_id_fkey"
            columns: ["target_rateation_id"]
            isOneToOne: false
            referencedRelation: "rateations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateation_debts_target_rateation_id_fkey"
            columns: ["target_rateation_id"]
            isOneToOne: false
            referencedRelation: "v_decadute_dettaglio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateation_debts_target_rateation_id_fkey"
            columns: ["target_rateation_id"]
            isOneToOne: false
            referencedRelation: "v_migrable_pagopa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateation_debts_target_rateation_id_fkey"
            columns: ["target_rateation_id"]
            isOneToOne: false
            referencedRelation: "v_pagopa_allocations"
            referencedColumns: ["pagopa_id"]
          },
          {
            foreignKeyName: "rateation_debts_target_rateation_id_fkey"
            columns: ["target_rateation_id"]
            isOneToOne: false
            referencedRelation: "v_pagopa_today_kpis"
            referencedColumns: ["rateation_id"]
          },
          {
            foreignKeyName: "rateation_debts_target_rateation_id_fkey"
            columns: ["target_rateation_id"]
            isOneToOne: false
            referencedRelation: "v_pagopa_unpaid_today"
            referencedColumns: ["rateation_id"]
          },
          {
            foreignKeyName: "rateation_debts_target_rateation_id_fkey"
            columns: ["target_rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rateation_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateation_debts_target_rateation_id_fkey"
            columns: ["target_rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_list_ui"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateation_debts_target_rateation_id_fkey"
            columns: ["target_rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_summary"
            referencedColumns: ["rateation_id"]
          },
          {
            foreignKeyName: "rateation_debts_target_rateation_id_fkey"
            columns: ["target_rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_summary_enhanced"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateation_debts_target_rateation_id_fkey"
            columns: ["target_rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_with_kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateation_debts_target_rateation_id_fkey"
            columns: ["target_rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rq_allocations"
            referencedColumns: ["rq_id"]
          },
          {
            foreignKeyName: "rateation_debts_target_rateation_id_fkey"
            columns: ["target_rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rq_contribuenti_aggregati"
            referencedColumns: ["riam_quater_id"]
          },
        ]
      }
      rateation_types: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          id: number
          is_active: boolean | null
          name: string
          owner_uid: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: number
          is_active?: boolean | null
          name: string
          owner_uid?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: number
          is_active?: boolean | null
          name?: string
          owner_uid?: string | null
        }
        Relationships: []
      }
      rateations: {
        Row: {
          created_at: string | null
          decadence_at: string | null
          decadence_confirmed_by: string | null
          decadence_installment_id: number | null
          decadence_reason: string | null
          frequency: string | null
          id: number
          interrupted_at: string | null
          interrupted_by_rateation_id: number | null
          interruption_reason: string | null
          is_f24: boolean
          is_quater: boolean | null
          notes: string | null
          number: string
          original_total_due_cents: number | null
          overdue_amount_cents: number | null
          overdue_at_interruption_cents: number | null
          owner_uid: string
          paid_amount_cents: number | null
          quater_total_due_cents: number | null
          replaced_by_rateation_id: number | null
          residual_amount_cents: number | null
          residual_at_decadence: number
          residual_at_decadence_cents: number | null
          residual_at_interruption_cents: number | null
          start_due_date: string | null
          status: string | null
          taxpayer_name: string | null
          total_amount: number | null
          transferred_amount: number
          type_id: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          decadence_at?: string | null
          decadence_confirmed_by?: string | null
          decadence_installment_id?: number | null
          decadence_reason?: string | null
          frequency?: string | null
          id?: number
          interrupted_at?: string | null
          interrupted_by_rateation_id?: number | null
          interruption_reason?: string | null
          is_f24?: boolean
          is_quater?: boolean | null
          notes?: string | null
          number: string
          original_total_due_cents?: number | null
          overdue_amount_cents?: number | null
          overdue_at_interruption_cents?: number | null
          owner_uid: string
          paid_amount_cents?: number | null
          quater_total_due_cents?: number | null
          replaced_by_rateation_id?: number | null
          residual_amount_cents?: number | null
          residual_at_decadence?: number
          residual_at_decadence_cents?: number | null
          residual_at_interruption_cents?: number | null
          start_due_date?: string | null
          status?: string | null
          taxpayer_name?: string | null
          total_amount?: number | null
          transferred_amount?: number
          type_id: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          decadence_at?: string | null
          decadence_confirmed_by?: string | null
          decadence_installment_id?: number | null
          decadence_reason?: string | null
          frequency?: string | null
          id?: number
          interrupted_at?: string | null
          interrupted_by_rateation_id?: number | null
          interruption_reason?: string | null
          is_f24?: boolean
          is_quater?: boolean | null
          notes?: string | null
          number?: string
          original_total_due_cents?: number | null
          overdue_amount_cents?: number | null
          overdue_at_interruption_cents?: number | null
          owner_uid?: string
          paid_amount_cents?: number | null
          quater_total_due_cents?: number | null
          replaced_by_rateation_id?: number | null
          residual_amount_cents?: number | null
          residual_at_decadence?: number
          residual_at_decadence_cents?: number | null
          residual_at_interruption_cents?: number | null
          start_due_date?: string | null
          status?: string | null
          taxpayer_name?: string | null
          total_amount?: number | null
          transferred_amount?: number
          type_id?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rateations_interrupted_by_rateation_id_fkey"
            columns: ["interrupted_by_rateation_id"]
            isOneToOne: false
            referencedRelation: "rateations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateations_interrupted_by_rateation_id_fkey"
            columns: ["interrupted_by_rateation_id"]
            isOneToOne: false
            referencedRelation: "v_decadute_dettaglio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateations_interrupted_by_rateation_id_fkey"
            columns: ["interrupted_by_rateation_id"]
            isOneToOne: false
            referencedRelation: "v_migrable_pagopa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateations_interrupted_by_rateation_id_fkey"
            columns: ["interrupted_by_rateation_id"]
            isOneToOne: false
            referencedRelation: "v_pagopa_allocations"
            referencedColumns: ["pagopa_id"]
          },
          {
            foreignKeyName: "rateations_interrupted_by_rateation_id_fkey"
            columns: ["interrupted_by_rateation_id"]
            isOneToOne: false
            referencedRelation: "v_pagopa_today_kpis"
            referencedColumns: ["rateation_id"]
          },
          {
            foreignKeyName: "rateations_interrupted_by_rateation_id_fkey"
            columns: ["interrupted_by_rateation_id"]
            isOneToOne: false
            referencedRelation: "v_pagopa_unpaid_today"
            referencedColumns: ["rateation_id"]
          },
          {
            foreignKeyName: "rateations_interrupted_by_rateation_id_fkey"
            columns: ["interrupted_by_rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rateation_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateations_interrupted_by_rateation_id_fkey"
            columns: ["interrupted_by_rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_list_ui"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateations_interrupted_by_rateation_id_fkey"
            columns: ["interrupted_by_rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_summary"
            referencedColumns: ["rateation_id"]
          },
          {
            foreignKeyName: "rateations_interrupted_by_rateation_id_fkey"
            columns: ["interrupted_by_rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_summary_enhanced"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateations_interrupted_by_rateation_id_fkey"
            columns: ["interrupted_by_rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_with_kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateations_interrupted_by_rateation_id_fkey"
            columns: ["interrupted_by_rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rq_allocations"
            referencedColumns: ["rq_id"]
          },
          {
            foreignKeyName: "rateations_interrupted_by_rateation_id_fkey"
            columns: ["interrupted_by_rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rq_contribuenti_aggregati"
            referencedColumns: ["riam_quater_id"]
          },
          {
            foreignKeyName: "rateations_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "rateation_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateations_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "v_scadenze"
            referencedColumns: ["type_id"]
          },
        ]
      }
      ravvedimento_profiles: {
        Row: {
          id: string
          is_default: boolean
          name: string
        }
        Insert: {
          id?: string
          is_default?: boolean
          name: string
        }
        Update: {
          id?: string
          is_default?: boolean
          name?: string
        }
        Relationships: []
      }
      ravvedimento_rules: {
        Row: {
          fixed_percent: number | null
          id: string
          max_days: number
          min_days: number
          mode: string
          per_day_percent: number | null
          priority: number
          profile_id: string
        }
        Insert: {
          fixed_percent?: number | null
          id?: string
          max_days: number
          min_days: number
          mode: string
          per_day_percent?: number | null
          priority?: number
          profile_id: string
        }
        Update: {
          fixed_percent?: number | null
          id?: string
          max_days?: number
          min_days?: number
          mode?: string
          per_day_percent?: number | null
          priority?: number
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ravvedimento_rules_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "ravvedimento_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      riam_quater_links: {
        Row: {
          allocated_residual_cents: number | null
          created_at: string
          id: string
          pagopa_id: number
          pagopa_residual_at_link_cents: number | null
          pagopa_taxpayer_at_link: string | null
          reason: string | null
          riam_quater_id: number
          risparmio_at_link_cents: number | null
          rq_taxpayer_at_link: string | null
          rq_total_at_link_cents: number | null
          unlinked_at: string | null
        }
        Insert: {
          allocated_residual_cents?: number | null
          created_at?: string
          id?: string
          pagopa_id: number
          pagopa_residual_at_link_cents?: number | null
          pagopa_taxpayer_at_link?: string | null
          reason?: string | null
          riam_quater_id: number
          risparmio_at_link_cents?: number | null
          rq_taxpayer_at_link?: string | null
          rq_total_at_link_cents?: number | null
          unlinked_at?: string | null
        }
        Update: {
          allocated_residual_cents?: number | null
          created_at?: string
          id?: string
          pagopa_id?: number
          pagopa_residual_at_link_cents?: number | null
          pagopa_taxpayer_at_link?: string | null
          reason?: string | null
          riam_quater_id?: number
          risparmio_at_link_cents?: number | null
          rq_taxpayer_at_link?: string | null
          rq_total_at_link_cents?: number | null
          unlinked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "riam_quater_links_pagopa_id_fkey"
            columns: ["pagopa_id"]
            isOneToOne: false
            referencedRelation: "rateations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "riam_quater_links_pagopa_id_fkey"
            columns: ["pagopa_id"]
            isOneToOne: false
            referencedRelation: "v_decadute_dettaglio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "riam_quater_links_pagopa_id_fkey"
            columns: ["pagopa_id"]
            isOneToOne: false
            referencedRelation: "v_migrable_pagopa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "riam_quater_links_pagopa_id_fkey"
            columns: ["pagopa_id"]
            isOneToOne: false
            referencedRelation: "v_pagopa_allocations"
            referencedColumns: ["pagopa_id"]
          },
          {
            foreignKeyName: "riam_quater_links_pagopa_id_fkey"
            columns: ["pagopa_id"]
            isOneToOne: false
            referencedRelation: "v_pagopa_today_kpis"
            referencedColumns: ["rateation_id"]
          },
          {
            foreignKeyName: "riam_quater_links_pagopa_id_fkey"
            columns: ["pagopa_id"]
            isOneToOne: false
            referencedRelation: "v_pagopa_unpaid_today"
            referencedColumns: ["rateation_id"]
          },
          {
            foreignKeyName: "riam_quater_links_pagopa_id_fkey"
            columns: ["pagopa_id"]
            isOneToOne: false
            referencedRelation: "v_rateation_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "riam_quater_links_pagopa_id_fkey"
            columns: ["pagopa_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_list_ui"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "riam_quater_links_pagopa_id_fkey"
            columns: ["pagopa_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_summary"
            referencedColumns: ["rateation_id"]
          },
          {
            foreignKeyName: "riam_quater_links_pagopa_id_fkey"
            columns: ["pagopa_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_summary_enhanced"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "riam_quater_links_pagopa_id_fkey"
            columns: ["pagopa_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_with_kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "riam_quater_links_pagopa_id_fkey"
            columns: ["pagopa_id"]
            isOneToOne: false
            referencedRelation: "v_rq_allocations"
            referencedColumns: ["rq_id"]
          },
          {
            foreignKeyName: "riam_quater_links_pagopa_id_fkey"
            columns: ["pagopa_id"]
            isOneToOne: false
            referencedRelation: "v_rq_contribuenti_aggregati"
            referencedColumns: ["riam_quater_id"]
          },
          {
            foreignKeyName: "riam_quater_links_riam_quater_id_fkey"
            columns: ["riam_quater_id"]
            isOneToOne: false
            referencedRelation: "rateations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "riam_quater_links_riam_quater_id_fkey"
            columns: ["riam_quater_id"]
            isOneToOne: false
            referencedRelation: "v_decadute_dettaglio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "riam_quater_links_riam_quater_id_fkey"
            columns: ["riam_quater_id"]
            isOneToOne: false
            referencedRelation: "v_migrable_pagopa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "riam_quater_links_riam_quater_id_fkey"
            columns: ["riam_quater_id"]
            isOneToOne: false
            referencedRelation: "v_pagopa_allocations"
            referencedColumns: ["pagopa_id"]
          },
          {
            foreignKeyName: "riam_quater_links_riam_quater_id_fkey"
            columns: ["riam_quater_id"]
            isOneToOne: false
            referencedRelation: "v_pagopa_today_kpis"
            referencedColumns: ["rateation_id"]
          },
          {
            foreignKeyName: "riam_quater_links_riam_quater_id_fkey"
            columns: ["riam_quater_id"]
            isOneToOne: false
            referencedRelation: "v_pagopa_unpaid_today"
            referencedColumns: ["rateation_id"]
          },
          {
            foreignKeyName: "riam_quater_links_riam_quater_id_fkey"
            columns: ["riam_quater_id"]
            isOneToOne: false
            referencedRelation: "v_rateation_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "riam_quater_links_riam_quater_id_fkey"
            columns: ["riam_quater_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_list_ui"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "riam_quater_links_riam_quater_id_fkey"
            columns: ["riam_quater_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_summary"
            referencedColumns: ["rateation_id"]
          },
          {
            foreignKeyName: "riam_quater_links_riam_quater_id_fkey"
            columns: ["riam_quater_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_summary_enhanced"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "riam_quater_links_riam_quater_id_fkey"
            columns: ["riam_quater_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_with_kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "riam_quater_links_riam_quater_id_fkey"
            columns: ["riam_quater_id"]
            isOneToOne: false
            referencedRelation: "v_rq_allocations"
            referencedColumns: ["rq_id"]
          },
          {
            foreignKeyName: "riam_quater_links_riam_quater_id_fkey"
            columns: ["riam_quater_id"]
            isOneToOne: false
            referencedRelation: "v_rq_contribuenti_aggregati"
            referencedColumns: ["riam_quater_id"]
          },
        ]
      }
    }
    Views: {
      v_dashboard_decaduto: {
        Row: {
          gross_decayed_cents: number | null
          net_to_transfer_cents: number | null
          transferred_cents: number | null
        }
        Relationships: []
      }
      v_dashboard_decaduto_preview: {
        Row: {
          potential_gross_decayed_cents: number | null
        }
        Relationships: []
      }
      v_deadlines_monthly: {
        Row: {
          amount: number | null
          cnt: number | null
          month: string | null
          owner_uid: string | null
        }
        Relationships: []
      }
      v_decadute_dettaglio: {
        Row: {
          decadence_at: string | null
          id: number | null
          number: string | null
          replaced_by_rateation_id: number | null
          residual_at_decadence: number | null
          taxpayer_name: string | null
          to_transfer: number | null
          transferred_amount: number | null
        }
        Relationships: []
      }
      v_installments_effective: {
        Row: {
          amount: number | null
          amount_cents: number | null
          apply_ravvedimento: boolean | null
          canceled_at: string | null
          created_at: string | null
          due_date: string | null
          effective_status: string | null
          extra_interest_euro: number | null
          extra_penalty_euro: number | null
          id: number | null
          interest_amount_cents: number | null
          interest_breakdown: Json | null
          is_paid: boolean | null
          late_days: number | null
          notes: string | null
          owner_uid: string | null
          paid_at: string | null
          paid_date: string | null
          paid_recorded_at: string | null
          paid_total_cents: number | null
          payment_method: string | null
          payment_mode: string | null
          penalty_amount_cents: number | null
          penalty_rule_id: string | null
          postponed: boolean | null
          rateation_id: number | null
          rateation_status: string | null
          receipt_url: string | null
          seq: number | null
          status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "rateations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_decadute_dettaglio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_migrable_pagopa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_pagopa_allocations"
            referencedColumns: ["pagopa_id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_pagopa_today_kpis"
            referencedColumns: ["rateation_id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_pagopa_unpaid_today"
            referencedColumns: ["rateation_id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rateation_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_list_ui"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_summary"
            referencedColumns: ["rateation_id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_summary_enhanced"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_with_kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rq_allocations"
            referencedColumns: ["rq_id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rq_contribuenti_aggregati"
            referencedColumns: ["riam_quater_id"]
          },
        ]
      }
      v_installments_status: {
        Row: {
          amount: number | null
          canceled_at: string | null
          days_late: number | null
          due_date: string | null
          id: number | null
          is_paid: boolean | null
          notes: string | null
          owner_uid: string | null
          paid_at: string | null
          payment_method: string | null
          postponed: boolean | null
          rateation_id: number | null
          receipt_url: string | null
          seq: number | null
          status: string | null
        }
        Insert: {
          amount?: number | null
          canceled_at?: string | null
          days_late?: never
          due_date?: string | null
          id?: number | null
          is_paid?: boolean | null
          notes?: string | null
          owner_uid?: string | null
          paid_at?: string | null
          payment_method?: string | null
          postponed?: boolean | null
          rateation_id?: number | null
          receipt_url?: string | null
          seq?: number | null
          status?: never
        }
        Update: {
          amount?: number | null
          canceled_at?: string | null
          days_late?: never
          due_date?: string | null
          id?: number | null
          is_paid?: boolean | null
          notes?: string | null
          owner_uid?: string | null
          paid_at?: string | null
          payment_method?: string | null
          postponed?: boolean | null
          rateation_id?: number | null
          receipt_url?: string | null
          seq?: number | null
          status?: never
        }
        Relationships: [
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "rateations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_decadute_dettaglio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_migrable_pagopa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_pagopa_allocations"
            referencedColumns: ["pagopa_id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_pagopa_today_kpis"
            referencedColumns: ["rateation_id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_pagopa_unpaid_today"
            referencedColumns: ["rateation_id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rateation_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_list_ui"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_summary"
            referencedColumns: ["rateation_id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_summary_enhanced"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_with_kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rq_allocations"
            referencedColumns: ["rq_id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rq_contribuenti_aggregati"
            referencedColumns: ["riam_quater_id"]
          },
        ]
      }
      v_kpi_rateations: {
        Row: {
          residual_amount_cents: number | null
        }
        Relationships: []
      }
      v_kpi_rateations_effective: {
        Row: {
          effective_residual_amount_cents: number | null
        }
        Relationships: []
      }
      v_kpi_rateations_overdue_effective: {
        Row: {
          effective_overdue_amount_cents: number | null
        }
        Relationships: []
      }
      v_migrable_pagopa: {
        Row: {
          allocatable_cents: number | null
          id: number | null
          interrupted_by_rateation_id: number | null
          number: string | null
          status: string | null
          taxpayer_name: string | null
          total_amount: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rateations_interrupted_by_rateation_id_fkey"
            columns: ["interrupted_by_rateation_id"]
            isOneToOne: false
            referencedRelation: "rateations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateations_interrupted_by_rateation_id_fkey"
            columns: ["interrupted_by_rateation_id"]
            isOneToOne: false
            referencedRelation: "v_decadute_dettaglio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateations_interrupted_by_rateation_id_fkey"
            columns: ["interrupted_by_rateation_id"]
            isOneToOne: false
            referencedRelation: "v_migrable_pagopa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateations_interrupted_by_rateation_id_fkey"
            columns: ["interrupted_by_rateation_id"]
            isOneToOne: false
            referencedRelation: "v_pagopa_allocations"
            referencedColumns: ["pagopa_id"]
          },
          {
            foreignKeyName: "rateations_interrupted_by_rateation_id_fkey"
            columns: ["interrupted_by_rateation_id"]
            isOneToOne: false
            referencedRelation: "v_pagopa_today_kpis"
            referencedColumns: ["rateation_id"]
          },
          {
            foreignKeyName: "rateations_interrupted_by_rateation_id_fkey"
            columns: ["interrupted_by_rateation_id"]
            isOneToOne: false
            referencedRelation: "v_pagopa_unpaid_today"
            referencedColumns: ["rateation_id"]
          },
          {
            foreignKeyName: "rateations_interrupted_by_rateation_id_fkey"
            columns: ["interrupted_by_rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rateation_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateations_interrupted_by_rateation_id_fkey"
            columns: ["interrupted_by_rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_list_ui"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateations_interrupted_by_rateation_id_fkey"
            columns: ["interrupted_by_rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_summary"
            referencedColumns: ["rateation_id"]
          },
          {
            foreignKeyName: "rateations_interrupted_by_rateation_id_fkey"
            columns: ["interrupted_by_rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_summary_enhanced"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateations_interrupted_by_rateation_id_fkey"
            columns: ["interrupted_by_rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_with_kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateations_interrupted_by_rateation_id_fkey"
            columns: ["interrupted_by_rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rq_allocations"
            referencedColumns: ["rq_id"]
          },
          {
            foreignKeyName: "rateations_interrupted_by_rateation_id_fkey"
            columns: ["interrupted_by_rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rq_contribuenti_aggregati"
            referencedColumns: ["riam_quater_id"]
          },
        ]
      }
      v_monthly_metrics: {
        Row: {
          due_amount: number | null
          extra_ravv_amount: number | null
          installments_count: number | null
          month: number | null
          overdue_amount: number | null
          owner_uid: string | null
          paid_amount: number | null
          paid_count: number | null
          year: number | null
        }
        Relationships: []
      }
      v_monthly_totals: {
        Row: {
          amount_due: number | null
          amount_paid: number | null
          month: string | null
          owner_uid: string | null
        }
        Relationships: []
      }
      v_pagopa_allocations: {
        Row: {
          allocatable_cents: number | null
          allocated_cents: number | null
          has_links: boolean | null
          owner_uid: string | null
          pagopa_id: number | null
          pagopa_number: string | null
          residual_cents: number | null
          taxpayer_name: string | null
        }
        Relationships: []
      }
      v_pagopa_linked_rq: {
        Row: {
          linked_at: string | null
          note: string | null
          pagopa_id: string | null
          pagopa_number: string | null
          pagopa_taxpayer: string | null
          residuo_pagopa_at_link_cents: number | null
          riam_quater_id: string | null
          risparmio_at_link_cents: number | null
          rq_number: string | null
          rq_taxpayer: string | null
          totale_rq_at_link_cents: number | null
        }
        Relationships: []
      }
      v_pagopa_today_kpis: {
        Row: {
          max_skips_effective: number | null
          rateation_id: number | null
          skip_remaining: number | null
          unpaid_overdue_today: number | null
        }
        Relationships: []
      }
      v_pagopa_unpaid_today: {
        Row: {
          at_risk_decadence: boolean | null
          paid_count: number | null
          paid_late_count: number | null
          rateation_id: number | null
          skip_remaining: number | null
          unpaid_count: number | null
          unpaid_overdue_today: number | null
        }
        Relationships: []
      }
      v_quater_saving_per_user: {
        Row: {
          owner_uid: string | null
          saving_eur: number | null
        }
        Relationships: []
      }
      v_rateation_installments: {
        Row: {
          amount: number | null
          days_overdue: number | null
          due_date: string | null
          extra_interest: number | null
          extra_penalty: number | null
          id: number | null
          owner_uid: string | null
          paid_date: string | null
          payment_mode: string | null
          rateation_id: number | null
          seq: number | null
          status: string | null
        }
        Insert: {
          amount?: number | null
          days_overdue?: never
          due_date?: string | null
          extra_interest?: never
          extra_penalty?: never
          id?: number | null
          owner_uid?: string | null
          paid_date?: string | null
          payment_mode?: string | null
          rateation_id?: number | null
          seq?: number | null
          status?: never
        }
        Update: {
          amount?: number | null
          days_overdue?: never
          due_date?: string | null
          extra_interest?: never
          extra_penalty?: never
          id?: number | null
          owner_uid?: string | null
          paid_date?: string | null
          payment_mode?: string | null
          rateation_id?: number | null
          seq?: number | null
          status?: never
        }
        Relationships: [
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "rateations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_decadute_dettaglio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_migrable_pagopa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_pagopa_allocations"
            referencedColumns: ["pagopa_id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_pagopa_today_kpis"
            referencedColumns: ["rateation_id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_pagopa_unpaid_today"
            referencedColumns: ["rateation_id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rateation_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_list_ui"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_summary"
            referencedColumns: ["rateation_id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_summary_enhanced"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_with_kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rq_allocations"
            referencedColumns: ["rq_id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rq_contribuenti_aggregati"
            referencedColumns: ["riam_quater_id"]
          },
        ]
      }
      v_rateation_summary: {
        Row: {
          extra_ravv_pagati: number | null
          first_due_date: string | null
          id: number | null
          importo_pagato_quota: number | null
          importo_totale: number | null
          last_activity: string | null
          last_due_date: string | null
          numero: string | null
          owner_uid: string | null
          rate_in_ritardo: number | null
          rate_pagate: number | null
          rate_pagate_ravv: number | null
          rate_totali: number | null
          taxpayer_name: string | null
          totale_residuo: number | null
          type_name: string | null
        }
        Relationships: []
      }
      v_rateations: {
        Row: {
          created_at: string | null
          descrizione: string | null
          due_date: string | null
          id: number | null
          importo: number | null
          numero: number | null
        }
        Insert: {
          created_at?: string | null
          descrizione?: never
          due_date?: string | null
          id?: number | null
          importo?: number | null
          numero?: number | null
        }
        Update: {
          created_at?: string | null
          descrizione?: never
          due_date?: string | null
          id?: number | null
          importo?: number | null
          numero?: number | null
        }
        Relationships: []
      }
      v_rateations_list_ui: {
        Row: {
          created_at: string | null
          id: number | null
          installments_overdue_today: number | null
          installments_paid: number | null
          installments_total: number | null
          is_f24: boolean | null
          is_pagopa: boolean | null
          is_quater: boolean | null
          number: string | null
          original_total_due_cents: number | null
          overdue_effective_cents: number | null
          owner_uid: string | null
          paid_amount_cents: number | null
          quater_total_due_cents: number | null
          residual_effective_cents: number | null
          status: string | null
          taxpayer_name: string | null
          tipo: string | null
          total_amount_cents: number | null
          type_id: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rateations_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "rateation_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateations_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "v_scadenze"
            referencedColumns: ["type_id"]
          },
        ]
      }
      v_rateations_summary: {
        Row: {
          amount_late: number | null
          amount_paid: number | null
          amount_residual: number | null
          amount_total: number | null
          installments_late: number | null
          installments_paid: number | null
          installments_total: number | null
          installments_unpaid: number | null
          number: string | null
          owner_uid: string | null
          rateation_id: number | null
          taxpayer_name: string | null
          type_name: string | null
        }
        Relationships: []
      }
      v_rateations_summary_enhanced: {
        Row: {
          amount_overdue: number | null
          amount_paid: number | null
          amount_residual: number | null
          id: number | null
          installments_overdue: number | null
          installments_paid: number | null
          installments_total: number | null
          installments_unpaid: number | null
          number: string | null
          owner_uid: string | null
          rateation_status: string | null
          taxpayer_name: string | null
          total_amount: number | null
          type_id: number | null
          type_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rateations_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "rateation_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateations_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "v_scadenze"
            referencedColumns: ["type_id"]
          },
        ]
      }
      v_rateations_with_kpis: {
        Row: {
          at_risk_decadence: boolean | null
          created_at: string | null
          debts_migrated: number | null
          debts_total: number | null
          due_today_cents: number | null
          excluded_from_stats: boolean | null
          id: number | null
          interrupted_at: string | null
          interrupted_by_rateation_id: number | null
          is_f24: boolean | null
          is_pagopa: boolean | null
          max_skips_effective: number | null
          migrated_debt_numbers: string[] | null
          number: string | null
          overdue_amount_cents: number | null
          overdue_at_interruption_cents: number | null
          overdue_effective_cents: number | null
          owner_uid: string | null
          paid_amount_cents: number | null
          rate_in_ritardo: number | null
          rate_pagate: number | null
          rate_totali: number | null
          remaining_debt_numbers: string[] | null
          residual_amount_cents: number | null
          residual_at_interruption_cents: number | null
          residual_effective_cents: number | null
          rq_migration_status: string | null
          rq_target_ids: number[] | null
          skip_remaining: number | null
          status: string | null
          taxpayer_name: string | null
          tipo: string | null
          total_amount: number | null
          total_amount_cents: number | null
          type_id: number | null
          unpaid_due_today: number | null
          unpaid_overdue_today: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rateations_interrupted_by_rateation_id_fkey"
            columns: ["interrupted_by_rateation_id"]
            isOneToOne: false
            referencedRelation: "rateations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateations_interrupted_by_rateation_id_fkey"
            columns: ["interrupted_by_rateation_id"]
            isOneToOne: false
            referencedRelation: "v_decadute_dettaglio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateations_interrupted_by_rateation_id_fkey"
            columns: ["interrupted_by_rateation_id"]
            isOneToOne: false
            referencedRelation: "v_migrable_pagopa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateations_interrupted_by_rateation_id_fkey"
            columns: ["interrupted_by_rateation_id"]
            isOneToOne: false
            referencedRelation: "v_pagopa_allocations"
            referencedColumns: ["pagopa_id"]
          },
          {
            foreignKeyName: "rateations_interrupted_by_rateation_id_fkey"
            columns: ["interrupted_by_rateation_id"]
            isOneToOne: false
            referencedRelation: "v_pagopa_today_kpis"
            referencedColumns: ["rateation_id"]
          },
          {
            foreignKeyName: "rateations_interrupted_by_rateation_id_fkey"
            columns: ["interrupted_by_rateation_id"]
            isOneToOne: false
            referencedRelation: "v_pagopa_unpaid_today"
            referencedColumns: ["rateation_id"]
          },
          {
            foreignKeyName: "rateations_interrupted_by_rateation_id_fkey"
            columns: ["interrupted_by_rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rateation_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateations_interrupted_by_rateation_id_fkey"
            columns: ["interrupted_by_rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_list_ui"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateations_interrupted_by_rateation_id_fkey"
            columns: ["interrupted_by_rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_summary"
            referencedColumns: ["rateation_id"]
          },
          {
            foreignKeyName: "rateations_interrupted_by_rateation_id_fkey"
            columns: ["interrupted_by_rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_summary_enhanced"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateations_interrupted_by_rateation_id_fkey"
            columns: ["interrupted_by_rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_with_kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateations_interrupted_by_rateation_id_fkey"
            columns: ["interrupted_by_rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rq_allocations"
            referencedColumns: ["rq_id"]
          },
          {
            foreignKeyName: "rateations_interrupted_by_rateation_id_fkey"
            columns: ["interrupted_by_rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rq_contribuenti_aggregati"
            referencedColumns: ["riam_quater_id"]
          },
          {
            foreignKeyName: "rateations_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "rateation_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateations_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "v_scadenze"
            referencedColumns: ["type_id"]
          },
        ]
      }
      v_risparmio_riam_quater: {
        Row: {
          pagopa_id: number | null
          pagopa_number: string | null
          pagopa_taxpayer: string | null
          residuo_pagopa: number | null
          riam_quater_id: number | null
          risparmio_stimato: number | null
          rq_number: string | null
          rq_taxpayer: string | null
          totale_rq: number | null
        }
        Relationships: [
          {
            foreignKeyName: "riam_quater_links_pagopa_id_fkey"
            columns: ["pagopa_id"]
            isOneToOne: false
            referencedRelation: "rateations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "riam_quater_links_pagopa_id_fkey"
            columns: ["pagopa_id"]
            isOneToOne: false
            referencedRelation: "v_decadute_dettaglio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "riam_quater_links_pagopa_id_fkey"
            columns: ["pagopa_id"]
            isOneToOne: false
            referencedRelation: "v_migrable_pagopa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "riam_quater_links_pagopa_id_fkey"
            columns: ["pagopa_id"]
            isOneToOne: false
            referencedRelation: "v_pagopa_allocations"
            referencedColumns: ["pagopa_id"]
          },
          {
            foreignKeyName: "riam_quater_links_pagopa_id_fkey"
            columns: ["pagopa_id"]
            isOneToOne: false
            referencedRelation: "v_pagopa_today_kpis"
            referencedColumns: ["rateation_id"]
          },
          {
            foreignKeyName: "riam_quater_links_pagopa_id_fkey"
            columns: ["pagopa_id"]
            isOneToOne: false
            referencedRelation: "v_pagopa_unpaid_today"
            referencedColumns: ["rateation_id"]
          },
          {
            foreignKeyName: "riam_quater_links_pagopa_id_fkey"
            columns: ["pagopa_id"]
            isOneToOne: false
            referencedRelation: "v_rateation_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "riam_quater_links_pagopa_id_fkey"
            columns: ["pagopa_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_list_ui"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "riam_quater_links_pagopa_id_fkey"
            columns: ["pagopa_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_summary"
            referencedColumns: ["rateation_id"]
          },
          {
            foreignKeyName: "riam_quater_links_pagopa_id_fkey"
            columns: ["pagopa_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_summary_enhanced"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "riam_quater_links_pagopa_id_fkey"
            columns: ["pagopa_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_with_kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "riam_quater_links_pagopa_id_fkey"
            columns: ["pagopa_id"]
            isOneToOne: false
            referencedRelation: "v_rq_allocations"
            referencedColumns: ["rq_id"]
          },
          {
            foreignKeyName: "riam_quater_links_pagopa_id_fkey"
            columns: ["pagopa_id"]
            isOneToOne: false
            referencedRelation: "v_rq_contribuenti_aggregati"
            referencedColumns: ["riam_quater_id"]
          },
          {
            foreignKeyName: "riam_quater_links_riam_quater_id_fkey"
            columns: ["riam_quater_id"]
            isOneToOne: false
            referencedRelation: "rateations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "riam_quater_links_riam_quater_id_fkey"
            columns: ["riam_quater_id"]
            isOneToOne: false
            referencedRelation: "v_decadute_dettaglio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "riam_quater_links_riam_quater_id_fkey"
            columns: ["riam_quater_id"]
            isOneToOne: false
            referencedRelation: "v_migrable_pagopa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "riam_quater_links_riam_quater_id_fkey"
            columns: ["riam_quater_id"]
            isOneToOne: false
            referencedRelation: "v_pagopa_allocations"
            referencedColumns: ["pagopa_id"]
          },
          {
            foreignKeyName: "riam_quater_links_riam_quater_id_fkey"
            columns: ["riam_quater_id"]
            isOneToOne: false
            referencedRelation: "v_pagopa_today_kpis"
            referencedColumns: ["rateation_id"]
          },
          {
            foreignKeyName: "riam_quater_links_riam_quater_id_fkey"
            columns: ["riam_quater_id"]
            isOneToOne: false
            referencedRelation: "v_pagopa_unpaid_today"
            referencedColumns: ["rateation_id"]
          },
          {
            foreignKeyName: "riam_quater_links_riam_quater_id_fkey"
            columns: ["riam_quater_id"]
            isOneToOne: false
            referencedRelation: "v_rateation_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "riam_quater_links_riam_quater_id_fkey"
            columns: ["riam_quater_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_list_ui"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "riam_quater_links_riam_quater_id_fkey"
            columns: ["riam_quater_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_summary"
            referencedColumns: ["rateation_id"]
          },
          {
            foreignKeyName: "riam_quater_links_riam_quater_id_fkey"
            columns: ["riam_quater_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_summary_enhanced"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "riam_quater_links_riam_quater_id_fkey"
            columns: ["riam_quater_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_with_kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "riam_quater_links_riam_quater_id_fkey"
            columns: ["riam_quater_id"]
            isOneToOne: false
            referencedRelation: "v_rq_allocations"
            referencedColumns: ["rq_id"]
          },
          {
            foreignKeyName: "riam_quater_links_riam_quater_id_fkey"
            columns: ["riam_quater_id"]
            isOneToOne: false
            referencedRelation: "v_rq_contribuenti_aggregati"
            referencedColumns: ["riam_quater_id"]
          },
        ]
      }
      v_risparmio_riam_quater_aggregato: {
        Row: {
          residuo_pagopa_tot: number | null
          riam_quater_id: number | null
          risparmio_stimato_tot: number | null
          rq_number: string | null
          rq_taxpayer: string | null
          totale_rq: number | null
        }
        Relationships: [
          {
            foreignKeyName: "riam_quater_links_riam_quater_id_fkey"
            columns: ["riam_quater_id"]
            isOneToOne: false
            referencedRelation: "rateations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "riam_quater_links_riam_quater_id_fkey"
            columns: ["riam_quater_id"]
            isOneToOne: false
            referencedRelation: "v_decadute_dettaglio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "riam_quater_links_riam_quater_id_fkey"
            columns: ["riam_quater_id"]
            isOneToOne: false
            referencedRelation: "v_migrable_pagopa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "riam_quater_links_riam_quater_id_fkey"
            columns: ["riam_quater_id"]
            isOneToOne: false
            referencedRelation: "v_pagopa_allocations"
            referencedColumns: ["pagopa_id"]
          },
          {
            foreignKeyName: "riam_quater_links_riam_quater_id_fkey"
            columns: ["riam_quater_id"]
            isOneToOne: false
            referencedRelation: "v_pagopa_today_kpis"
            referencedColumns: ["rateation_id"]
          },
          {
            foreignKeyName: "riam_quater_links_riam_quater_id_fkey"
            columns: ["riam_quater_id"]
            isOneToOne: false
            referencedRelation: "v_pagopa_unpaid_today"
            referencedColumns: ["rateation_id"]
          },
          {
            foreignKeyName: "riam_quater_links_riam_quater_id_fkey"
            columns: ["riam_quater_id"]
            isOneToOne: false
            referencedRelation: "v_rateation_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "riam_quater_links_riam_quater_id_fkey"
            columns: ["riam_quater_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_list_ui"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "riam_quater_links_riam_quater_id_fkey"
            columns: ["riam_quater_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_summary"
            referencedColumns: ["rateation_id"]
          },
          {
            foreignKeyName: "riam_quater_links_riam_quater_id_fkey"
            columns: ["riam_quater_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_summary_enhanced"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "riam_quater_links_riam_quater_id_fkey"
            columns: ["riam_quater_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_with_kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "riam_quater_links_riam_quater_id_fkey"
            columns: ["riam_quater_id"]
            isOneToOne: false
            referencedRelation: "v_rq_allocations"
            referencedColumns: ["rq_id"]
          },
          {
            foreignKeyName: "riam_quater_links_riam_quater_id_fkey"
            columns: ["riam_quater_id"]
            isOneToOne: false
            referencedRelation: "v_rq_contribuenti_aggregati"
            referencedColumns: ["riam_quater_id"]
          },
        ]
      }
      v_rq_allocations: {
        Row: {
          allocated_residual_cents: number | null
          owner_uid: string | null
          quater_total_due_cents: number | null
          rq_id: number | null
        }
        Relationships: []
      }
      v_rq_contribuenti_aggregati: {
        Row: {
          linked_taxpayers: string | null
          riam_quater_id: number | null
          rq_number: string | null
          rq_taxpayer: string | null
        }
        Relationships: []
      }
      v_scadenze: {
        Row: {
          aging_band: string | null
          amount: number | null
          bucket: string | null
          days_overdue: number | null
          due_date: string | null
          due_month: string | null
          due_week: string | null
          id: number | null
          is_paid: boolean | null
          owner_uid: string | null
          paid_at: string | null
          rateation_id: number | null
          rateation_number: string | null
          rateation_status: string | null
          seq: number | null
          taxpayer_name: string | null
          type_id: number | null
          type_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "rateations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_decadute_dettaglio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_migrable_pagopa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_pagopa_allocations"
            referencedColumns: ["pagopa_id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_pagopa_today_kpis"
            referencedColumns: ["rateation_id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_pagopa_unpaid_today"
            referencedColumns: ["rateation_id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rateation_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_list_ui"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_summary"
            referencedColumns: ["rateation_id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_summary_enhanced"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rateations_with_kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rq_allocations"
            referencedColumns: ["rq_id"]
          },
          {
            foreignKeyName: "installments_rateation_id_fkey"
            columns: ["rateation_id"]
            isOneToOne: false
            referencedRelation: "v_rq_contribuenti_aggregati"
            referencedColumns: ["riam_quater_id"]
          },
        ]
      }
    }
    Functions: {
      apply_rateation_edits: {
        Args: { p_rateation_id: number; p_rows: Json }
        Returns: undefined
      }
      apply_ravvedimento: {
        Args: {
          p_installment_id: number
          p_paid_at: string
          p_profile_id?: string
        }
        Returns: Json
      }
      apply_ravvedimento_manual: {
        Args: {
          p_installment_id: number
          p_paid_at: string
          p_paid_total_cents: number
          p_profile_id?: string
        }
        Returns: {
          amount: number
          amount_cents: number | null
          apply_ravvedimento: boolean | null
          canceled_at: string | null
          created_at: string | null
          due_date: string
          extra_interest_euro: number | null
          extra_penalty_euro: number | null
          id: number
          interest_amount_cents: number | null
          interest_breakdown: Json | null
          is_paid: boolean | null
          late_days: number | null
          notes: string | null
          owner_uid: string
          paid_at: string | null
          paid_date: string | null
          paid_recorded_at: string | null
          paid_total_cents: number | null
          payment_method: string | null
          payment_mode: string | null
          penalty_amount_cents: number | null
          penalty_rule_id: string | null
          postponed: boolean | null
          rateation_id: number
          receipt_url: string | null
          seq: number
          status: string | null
        }
      }
      cancel_installment_payment: {
        Args: { p_installment_id: number }
        Returns: {
          amount: number
          amount_cents: number | null
          apply_ravvedimento: boolean | null
          canceled_at: string | null
          created_at: string | null
          due_date: string
          extra_interest_euro: number | null
          extra_penalty_euro: number | null
          id: number
          interest_amount_cents: number | null
          interest_breakdown: Json | null
          is_paid: boolean | null
          late_days: number | null
          notes: string | null
          owner_uid: string
          paid_at: string | null
          paid_date: string | null
          paid_recorded_at: string | null
          paid_total_cents: number | null
          payment_method: string | null
          payment_mode: string | null
          penalty_amount_cents: number | null
          penalty_rule_id: string | null
          postponed: boolean | null
          rateation_id: number
          receipt_url: string | null
          seq: number
          status: string | null
        }
      }
      compute_ravvedimento: {
        Args: {
          p_amount_cents: number
          p_due_date: string
          p_paid_at: string
          p_profile_id?: string
        }
        Returns: Json
      }
      deadlines_counts: {
        Args: {
          p_bucket?: string
          p_end_date?: string
          p_search?: string
          p_start_date?: string
          p_type_ids?: number[]
        }
        Returns: {
          paid_count: number
          total_count: number
          unpaid_count: number
        }[]
      }
      debug_rateations_count: {
        Args: Record<PropertyKey, never>
        Returns: {
          rateations_count: number
          user_id: string
        }[]
      }
      fn_create_rateation_auto: {
        Args: {
          p_amount_per_installment: number
          p_frequency: string
          p_num_installments: number
          p_number: string
          p_start_due_date: string
          p_taxpayer_name: string
          p_type_id: number
        }
        Returns: number
      }
      fn_create_rateation_manual: {
        Args: {
          p_installments_json: Json
          p_number: string
          p_taxpayer_name: string
          p_type_id: number
        }
        Returns: number
      }
      fn_detect_orphaned_migrations: {
        Args: Record<PropertyKey, never>
        Returns: {
          debt_id: string
          details: Json
          issue_type: string
        }[]
      }
      fn_detect_payment_inconsistencies: {
        Args: Record<PropertyKey, never>
        Returns: {
          details: Json
          installment_id: number
          issue_type: string
          rateation_id: number
        }[]
      }
      fn_postpone_installment: {
        Args: { p_new_due: string; p_rateation_id: number; p_seq: number }
        Returns: undefined
      }
      fn_realign_rateation_totals: {
        Args: { p_rateation_id: number } | { p_rateation_id: string }
        Returns: Json
      }
      fn_recalc_rateation_status: {
        Args: { p_rateation_id: number }
        Returns: undefined
      }
      fn_set_installment_paid: {
        Args: {
          p_paid: boolean
          p_paid_at: string
          p_rateation_id: number
          p_seq: number
        }
        Returns: undefined
      }
      fn_verify_kpi_coherence: {
        Args: Record<PropertyKey, never>
        Returns: {
          details: Json
          is_coherent: boolean
          is_overdue_coherent: boolean
          is_residual_coherent: boolean
          overdue_difference_cents: number
          overdue_effettivo_cents: number
          overdue_expected_difference_cents: number
          overdue_interrotte_snapshot_cents: number
          overdue_storico_cents: number
          residual_difference_cents: number
          residual_effettivo_cents: number
          residual_expected_difference_cents: number
          residual_interrotte_snapshot_cents: number
          residual_storico_cents: number
          status: string
        }[]
      }
      get_rq_available_for_pagopa: {
        Args: { p_pagopa_id: number }
        Returns: {
          id: number
          number: string
          quater_total_due_cents: number
          taxpayer_name: string
        }[]
      }
      installment_cancel_payment: {
        Args: { p_installment_id: number; p_reason?: string }
        Returns: undefined
      }
      installment_cancel_payment_enhanced: {
        Args: { p_installment_id: number; p_reason?: string }
        Returns: undefined
      }
      installment_cancel_payment_enhanced_v2: {
        Args: { p_installment_id: number; p_reason?: string }
        Returns: undefined
      }
      is_rq_reason: {
        Args: { txt: string }
        Returns: boolean
      }
      link_pagopa_to_rq_atomic: {
        Args: {
          p_alloc_cents: number
          p_pagopa_id: number
          p_reason?: string
          p_rq_id: number
        }
        Returns: {
          action: string
          allocated_residual_cents: number
          pagopa_id: number
          reason: string
          riam_quater_id: number
        }[]
      }
      link_pagopa_unlink: {
        Args: { p_pagopa_id: number; p_reason?: string; p_rq_id: number }
        Returns: {
          action: string
          pagopa_id: number
          riam_quater_id: number
          unlocked: boolean
        }[]
      }
      mark_installment_paid: {
        Args: { p_paid_at: string; p_rateation_id: number; p_seq: number }
        Returns: undefined
      }
      mark_installment_paid_ordinary: {
        Args: { p_paid_at: string; p_rateation_id: number; p_seq: number }
        Returns: undefined
      }
      mark_installment_paid_ordinary_new: {
        Args: {
          p_amount_paid?: number
          p_installment_id: number
          p_paid_date: string
        }
        Returns: undefined
      }
      mark_installment_paid_ravvedimento_new: {
        Args: {
          p_installment_id: number
          p_interest?: number
          p_paid_date: string
          p_penalty?: number
          p_total_paid: number
        }
        Returns: undefined
      }
      migrate_debts_to_rq: {
        Args: {
          p_debt_ids: string[]
          p_note?: string
          p_source_rateation_id: number
          p_target_rateation_id: number
        }
        Returns: undefined
      }
      pagopa_lock_for_rq: {
        Args: { p_pagopa_id: number }
        Returns: undefined
      }
      pagopa_migrate_attach_rq: {
        Args: { p_note?: string; p_pagopa_id: number; p_rq_ids: number[] }
        Returns: {
          link_id: number
          riam_quater_id: number
        }[]
      }
      pagopa_quota_info: {
        Args: { p_pagopa_id: number }
        Returns: {
          allocatable_cents: number
          allocated_cents: number
          residual_cents: number
        }[]
      }
      pagopa_unlink_rq: {
        Args: { p_pagopa_id: number; p_rq_ids?: number[] }
        Returns: boolean
      }
      pagopa_unlock_if_no_links: {
        Args: { p_pagopa_id: number }
        Returns: boolean
      }
      rateation_auto_flag_predecadence: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      rateation_confirm_decadence: {
        Args: {
          p_installment_id?: number
          p_rateation_id: number
          p_reason?: string
        }
        Returns: undefined
      }
      rateation_link_transfer: {
        Args: { p_amount: number; p_f24_id: number; p_pagopa_id: number }
        Returns: undefined
      }
      rateations_recalc_totals: {
        Args: { p_rateation_id: number }
        Returns: undefined
      }
      recompute_rateation_caches: {
        Args: { p_rateation_id: number }
        Returns: undefined
      }
      rollback_debt_migration: {
        Args: { p_debt_ids: string[]; p_source_rateation_id: number }
        Returns: undefined
      }
      sanitize_legacy_interruption_reasons: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      unmark_installment_paid: {
        Args: { p_rateation_id: number; p_seq: number }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
