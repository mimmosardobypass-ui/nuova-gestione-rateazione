/**
 * Main hook for Statistics Dashboard
 * Fetches data via get_filtered_stats() RPC + v_quater_saving_per_user
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client-resilient';
import { useQuaterSaving } from '@/hooks/useQuaterSaving';
import type { StatsFilters, FilteredStats, StatsKPIs } from '../types/stats';
import { formatCentsToEur } from '../utils/statsFormatters';

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

  const { saving: quaterSaving, loading: savingLoading } = useQuaterSaving();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Se includeClosed è false e statuses è null, forza ['attiva', 'completata', 'decaduta']
      let effectiveStatuses = filters.statuses;
      if (!filters.includeClosed && !filters.statuses) {
        effectiveStatuses = ['attiva', 'completata', 'decaduta'];
      }

      const { data, error: rpcError } = await supabase.rpc('get_filtered_stats', {
        p_start_date: filters.startDate,
        p_end_date: filters.endDate,
        p_type_labels: filters.typeLabels,
        p_statuses: effectiveStatuses,
        p_taxpayer_search: filters.taxpayerSearch,
        p_owner_only: filters.ownerOnly,
      });

      if (rpcError) throw rpcError;

      setStats(data as FilteredStats);
    } catch (e: any) {
      console.error('[useStats]', e);
      setError(e.message || 'Errore caricamento statistiche');
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  // Calculate KPIs from stats
  const kpis: StatsKPIs = {
    residual_total: stats?.by_status.reduce((sum, s) => sum + formatCentsToEur(s.residual_amount_cents), 0) || 0,
    paid_total: stats?.by_status.reduce((sum, s) => sum + formatCentsToEur(s.paid_amount_cents), 0) || 0,
    overdue_total: stats?.by_status.reduce((sum, s) => sum + formatCentsToEur(s.overdue_amount_cents), 0) || 0,
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
