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
      installments: {
        Row: {
          amount: number
          canceled_at: string | null
          created_at: string | null
          due_date: string
          id: number
          interest_amount_cents: number | null
          interest_breakdown: Json | null
          is_paid: boolean | null
          late_days: number | null
          notes: string | null
          owner_uid: string
          paid_at: string | null
          paid_recorded_at: string | null
          paid_total_cents: number | null
          payment_method: string | null
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
          canceled_at?: string | null
          created_at?: string | null
          due_date: string
          id?: number
          interest_amount_cents?: number | null
          interest_breakdown?: Json | null
          is_paid?: boolean | null
          late_days?: number | null
          notes?: string | null
          owner_uid: string
          paid_at?: string | null
          paid_recorded_at?: string | null
          paid_total_cents?: number | null
          payment_method?: string | null
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
          canceled_at?: string | null
          created_at?: string | null
          due_date?: string
          id?: number
          interest_amount_cents?: number | null
          interest_breakdown?: Json | null
          is_paid?: boolean | null
          late_days?: number | null
          notes?: string | null
          owner_uid?: string
          paid_at?: string | null
          paid_recorded_at?: string | null
          paid_total_cents?: number | null
          payment_method?: string | null
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
          frequency: string | null
          id: number
          notes: string | null
          number: string
          owner_uid: string
          start_due_date: string | null
          status: string | null
          taxpayer_name: string | null
          total_amount: number | null
          type_id: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          frequency?: string | null
          id?: number
          notes?: string | null
          number: string
          owner_uid: string
          start_due_date?: string | null
          status?: string | null
          taxpayer_name?: string | null
          total_amount?: number | null
          type_id: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          frequency?: string | null
          id?: number
          notes?: string | null
          number?: string
          owner_uid?: string
          start_due_date?: string | null
          status?: string | null
          taxpayer_name?: string | null
          total_amount?: number | null
          type_id?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rateations_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "rateation_types"
            referencedColumns: ["id"]
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
    }
    Views: {
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
        ]
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
        ]
      }
    }
    Functions: {
      apply_ravvedimento: {
        Args: {
          p_installment_id: number
          p_paid_at: string
          p_profile_id?: string
        }
        Returns: Json
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
      fn_postpone_installment: {
        Args: { p_new_due: string; p_rateation_id: number; p_seq: number }
        Returns: undefined
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
      mark_installment_paid: {
        Args: { p_paid_at: string; p_rateation_id: number; p_seq: number }
        Returns: undefined
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
