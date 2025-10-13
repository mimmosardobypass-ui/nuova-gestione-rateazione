import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface StatsV3Filters {
  dateFrom: string | null;
  dateTo: string | null;
  types: string[] | null;
  statuses: string[] | null;
  includeInterrupted: boolean;
  includeDecayed: boolean;
  groupBy: 'due' | 'created';
}

export interface StatsV3KPIs {
  total_due_cents: number;
  total_paid_cents: number;
  total_residual_cents: number;
  total_overdue_cents: number;
  total_decayed_cents: number;
  rq_saving_cents: number;
  completion_percent: number;
}

export interface StatsV3ByType {
  type: string;
  count: number;
  total_cents: number;
  paid_cents: number;
  residual_cents: number;
  overdue_cents: number;
  avg_completion_percent: number;
}

export interface StatsV3ByStatus {
  status: string;
  count: number;
  total_cents: number;
}

export interface StatsV3Series {
  month: string;
  total_cents: number;
  paid_cents: number;
  residual_cents: number;
}

export interface StatsV3Detail {
  id: number;
  number: string;
  type: string;
  status: string;
  taxpayer_name: string | null;
  total_cents: number;
  paid_cents: number;
  residual_cents: number;
  overdue_cents: number;
  installments_total: number;
  installments_paid: number;
  completion_percent: number;
  created_at: string;
}

export interface StatsV3Data {
  meta: {
    version: string;
    generated_at: string;
    filters_applied: any;
  };
  kpis: StatsV3KPIs;
  by_type: StatsV3ByType[];
  by_status: StatsV3ByStatus[];
  series: StatsV3Series[];
  details: StatsV3Detail[];
}

export function useStatsV3(filters: StatsV3Filters) {
  const [data, setData] = useState<StatsV3Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: result, error: rpcError } = await supabase.rpc("stats_v3", {
        p_date_from: filters.dateFrom,
        p_date_to: filters.dateTo,
        p_types: filters.types,
        p_statuses: filters.statuses,
        p_include_interrupted: filters.includeInterrupted,
        p_include_decayed: filters.includeDecayed,
        p_group_by: filters.groupBy,
        p_owner: null,
      });

      if (rpcError) throw rpcError;
      
      setData(result as unknown as StatsV3Data);
    } catch (err: any) {
      setError(err.message || "Errore nel caricamento dei dati");
      console.error("[useStatsV3]", err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, reload: fetchData };
}
