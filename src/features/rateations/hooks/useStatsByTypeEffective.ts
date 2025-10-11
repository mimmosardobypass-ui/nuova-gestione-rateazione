/**
 * Hook per statistiche per tipologia con regola F24↔PagoPA
 * Usa la RPC stats_per_tipologia_effective() che esclude residui/ritardi
 * delle F24 interrotte per link PagoPA
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client-resilient';
import type { StatsFilters, StatsByType } from '../types/stats';
import { buildTypesArg, buildStatusesArg, DB_TO_DISPLAY } from '../utils/statsArgs';

interface UseStatsByTypeEffectiveResult {
  byType: StatsByType[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useStatsByTypeEffective(
  filters: StatsFilters
): UseStatsByTypeEffectiveResult {
  const [byType, setByType] = useState<StatsByType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Normalizza payload per la RPC
  const rpcArgs = useMemo(() => {
    const toYMD = (d?: string | Date | null) =>
      d ? new Date(d).toISOString().slice(0, 10) : null;

    return {
      p_start_date: toYMD(filters.startDate),
      p_end_date: toYMD(filters.endDate),
      p_statuses: buildStatusesArg(filters),
      p_type_labels: buildTypesArg(filters.typeLabels),
      p_include_closed: !!filters.includeClosed,
    };
  }, [filters]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('[useStatsByTypeEffective] RPC args:', rpcArgs);
      const { data, error: rpcError } = await supabase.rpc('stats_per_tipologia_effective', rpcArgs);
      console.log('[useStatsByTypeEffective] RPC data:', data);
      if (rpcError) throw rpcError;

      const mapped: StatsByType[] = (data ?? []).map((row: any) => ({
        type_label: DB_TO_DISPLAY[row?.type_label] ?? row?.type_label,
        count: Number(row?.count ?? 0),
        total_amount_cents: Number(row?.total_amount_cents ?? 0),
        paid_amount_cents: Number(row?.paid_amount_cents ?? 0),
        residual_amount_cents: Number(row?.residual_amount_cents ?? 0),
        overdue_amount_cents: Number(row?.overdue_amount_cents ?? 0),
      }))
      .sort((a, b) => {
        const order = ['F24', 'PagoPA', 'Rottamazione Quater', 'Riam. Quater', 'Altro'];
        const idxA = order.indexOf(a.type_label);
        const idxB = order.indexOf(b.type_label);
        
        if (idxA === -1 && idxB === -1) return a.type_label.localeCompare(b.type_label);
        if (idxA === -1) return 1;
        if (idxB === -1) return -1;
        return idxA - idxB;
      });

      setByType(mapped);
    } catch (e: any) {
      console.error('[useStatsByTypeEffective]', e);
      setError(e?.message ?? 'Errore caricamento statistiche per tipologia');
      setByType([]);
    } finally {
      setLoading(false);
    }
  }, [rpcArgs]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    byType,
    loading,
    error,
    reload: load,
  };
}
