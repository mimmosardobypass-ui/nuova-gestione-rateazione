/**
 * Main hook for Statistics Dashboard
 * Fetches data via get_filtered_stats() RPC + v_quater_saving_per_user
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client-resilient';
import { useQuaterSaving } from '@/hooks/useQuaterSaving';
import type { StatsFilters, FilteredStats, StatsKPIs } from '../types/stats';
import { formatCentsToEur } from '../utils/statsFormatters';
import { buildTypesArg, buildStatusesArg } from '../utils/statsArgs';
import { RATEATION_CHANGED, RATEATION_DELETED } from '@/lib/events';

interface UseStatsResult {
  stats: FilteredStats | null;
  kpis: StatsKPIs;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useStats(filters: StatsFilters): UseStatsResult {
  const [stats, setStats] = useState<FilteredStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rpcKpis, setRpcKpis] = useState({ residual: 0, paid: 0, overdue: 0 });

  const { saving: quaterSaving, loading: savingLoading } = useQuaterSaving();

  // Normalizza payload per la RPC
  const rpcArgs = useMemo(() => {
    return {
      p_start_date: filters.startDate || null,
      p_end_date: filters.endDate || null,
      p_types: buildTypesArg(filters.typeLabels),
      p_statuses: buildStatusesArg(filters.statuses),
      p_taxpayer_search: filters.taxpayerSearch && filters.taxpayerSearch.trim() !== ''
        ? filters.taxpayerSearch.trim()
        : null,
      p_owner_only: Boolean(filters.ownerOnly),
      p_include_closed: Boolean(filters.includeClosed),
    } as const;
  }, [filters]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc('get_filtered_stats', rpcArgs);

      if (rpcError) throw rpcError;

      // Guard-rail: assicura struttura completa
      const safeStats: FilteredStats = {
        by_type: Array.isArray(data?.by_type) ? data.by_type : [],
        by_status: Array.isArray(data?.by_status) ? data.by_status : [],
        by_taxpayer: Array.isArray(data?.by_taxpayer) ? data.by_taxpayer : [],
        cashflow: [], // TODO: implementare cashflow nella RPC
      };

      // KPI dalla RPC (più affidabili del calcolo client-side)
      setRpcKpis({
        residual: formatCentsToEur(data?.kpi_residual_amount_cents ?? 0),
        paid: formatCentsToEur(data?.kpi_paid_amount_cents ?? 0),
        overdue: formatCentsToEur(data?.kpi_overdue_amount_cents ?? 0),
      });

      setStats(safeStats);
    } catch (e: any) {
      console.error('[useStats] Error:', e);
      setError(e?.message ?? 'Errore caricamento statistiche');
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [rpcArgs]);

  useEffect(() => {
    void load();
  }, [load]);

  // Event listener for rateation changes (soft-delete support)
  useEffect(() => {
    const handleRateationChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      console.debug("[useStats] Rateation event received:", e.type, detail);
      void load();
    };
    
    window.addEventListener(RATEATION_CHANGED, handleRateationChange);
    window.addEventListener(RATEATION_DELETED, handleRateationChange);
    
    return () => {
      window.removeEventListener(RATEATION_CHANGED, handleRateationChange);
      window.removeEventListener(RATEATION_DELETED, handleRateationChange);
    };
  }, [load]);

  // KPI: usa valori dalla RPC + risparmio quater separato
  const kpis: StatsKPIs = {
    residual_total: rpcKpis.residual,
    paid_total: rpcKpis.paid,
    overdue_total: rpcKpis.overdue,
    quater_saving: quaterSaving,
  };

  return {
    stats,
    kpis,
    loading: loading || savingLoading,
    error,
    reload: load,
  };
}
