export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      installments: {
        Row: {
          amount: number
          created_at: string | null
          due_date: string
          id: number
          is_paid: boolean | null
          owner_uid: string
          paid_at: string | null
          postponed: boolean | null
          rateation_id: number
          seq: number
        }
        Insert: {
          amount: number
          created_at?: string | null
          due_date: string
          id?: number
          is_paid?: boolean | null
          owner_uid: string
          paid_at?: string | null
          postponed?: boolean | null
          rateation_id: number
          seq: number
        }
        Update: {
          amount?: number
          created_at?: string | null
          due_date?: string
          id?: number
          is_paid?: boolean | null
          owner_uid?: string
          paid_at?: string | null
          postponed?: boolean | null
          rateation_id?: number
          seq?: number
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
          owner_uid: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: number
          is_active?: boolean | null
          name: string
          owner_uid: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: number
          is_active?: boolean | null
          name?: string
          owner_uid?: string
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
    Views: {
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
          amount: number | null
          created_at: string | null
          description: string | null
          due_date: string | null
          id: number | null
          number: number | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          description?: never
          due_date?: string | null
          id?: number | null
          number?: number | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          description?: never
          due_date?: string | null
          id?: number | null
          number?: number | null
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
    }
    Functions: {
      fn_create_rateation_auto: {
        Args: {
          p_number: string
          p_type_id: number
          p_taxpayer_name: string
          p_start_due_date: string
          p_frequency: string
          p_num_installments: number
          p_amount_per_installment: number
        }
        Returns: number
      }
      fn_create_rateation_manual: {
        Args: {
          p_number: string
          p_type_id: number
          p_taxpayer_name: string
          p_installments_json: Json
        }
        Returns: number
      }
      fn_postpone_installment: {
        Args: { p_rateation_id: number; p_seq: number; p_new_due: string }
        Returns: undefined
      }
      fn_recalc_rateation_status: {
        Args: { p_rateation_id: number }
        Returns: undefined
      }
      fn_set_installment_paid: {
        Args: {
          p_rateation_id: number
          p_seq: number
          p_paid: boolean
          p_paid_at: string
        }
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
