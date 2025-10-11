import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client-resilient';
import type { AdvStatsFilters, AdvStatsPayload } from '../types/advStats';
import { buildTypesArg, buildStatusesArg } from '../utils/advStatsArgs';

interface UseAdvancedStatsResult {
  data: AdvStatsPayload | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useAdvancedStats(filters: AdvStatsFilters): UseAdvancedStatsResult {
  const [data, setData] = useState<AdvStatsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const args = useMemo(() => ({
    p_start_date: filters.startDate,
    p_end_date: filters.endDate,
    p_types: buildTypesArg(filters.typeLabels),       // 1+ selezioni ⇒ array esatto; 0 ⇒ null (tutti)
    p_statuses: buildStatusesArg(filters.statuses),   // array oppure null
    p_taxpayer_search: filters.taxpayerSearch?.trim() || null,
    p_owner_only: !!filters.ownerOnly,
    p_include_closed: !!filters.includeClosed,
    p_group_by: filters.groupBy,
  }), [filters]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('[useAdvancedStats] RPC args:', args);
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_advanced_stats_v2', args);
      
      if (rpcError) throw rpcError;
      
      console.log('[useAdvancedStats] RPC response:', rpcData);
      
      // Contratto robusto: sempre tutte le chiavi presenti
      const payload: AdvStatsPayload = {
        meta: rpcData?.meta ?? {
          version: 'v2',
          group_by: filters.groupBy,
          generated_at: new Date().toISOString()
        },
        inputs_echo: rpcData?.inputs_echo ?? args,
        kpi: rpcData?.kpi ?? {
          total_amount_cents: 0,
          residual_amount_cents: 0,
          paid_amount_cents: 0
        },
        by_type: Array.isArray(rpcData?.by_type) ? rpcData.by_type : [],
        by_status: Array.isArray(rpcData?.by_status) ? rpcData.by_status : [],
        by_taxpayer: Array.isArray(rpcData?.by_taxpayer) ? rpcData.by_taxpayer : [],
        top_taxpayers: Array.isArray(rpcData?.top_taxpayers) ? rpcData.top_taxpayers : [],
        series_monthly: Array.isArray(rpcData?.series_monthly) ? rpcData.series_monthly : [],
        errors: Array.isArray(rpcData?.errors) ? rpcData.errors : [],
      };
      
      setData(payload);
    } catch (e: any) {
      console.error('[useAdvancedStats] Error:', e);
      setError(e?.message ?? 'Errore caricamento statistiche avanzate');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [args, filters.groupBy]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, reload: load };
}
