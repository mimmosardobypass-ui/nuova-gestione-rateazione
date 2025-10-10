/**
 * Hook per statistiche per tipologia con regola F24↔PagoPA
 * Usa la RPC stats_per_tipologia_effective() che esclude residui/ritardi
 * delle F24 interrotte per link PagoPA
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client-resilient';
import type { StatsFilters, StatsByType } from '../types/stats';

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

    const U = (s: string) => (s ?? '').toUpperCase();

    const CLOSED = ['INTERROTTA', 'ESTINTA'];
    const OPERATIVE = ['ATTIVA', 'IN_RITARDO', 'COMPLETATA', 'DECADUTA'];

    const inputStatuses = (filters.statuses ?? []).map(U);

    let effectiveStatuses: string[] | null;
    if (!filters.includeClosed) {
      if (inputStatuses.length === 0) {
        effectiveStatuses = OPERATIVE;
      } else {
        const tmp = inputStatuses.filter(s => !CLOSED.includes(s));
        effectiveStatuses = tmp.length ? tmp : ['__NO_MATCH__'];
      }
    } else {
      effectiveStatuses = inputStatuses.length ? inputStatuses : null;
    }

    const typeLabels = filters.typeLabels && filters.typeLabels.length ? filters.typeLabels : null;

    return {
      p_date_from: toYMD(filters.startDate),
      p_date_to: toYMD(filters.endDate),
      p_states: effectiveStatuses,
      p_types: typeLabels,
      p_include_interrupted_estinte: !!filters.includeClosed,
    };
  }, [filters]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc('stats_per_tipologia_effective', rpcArgs);
      if (rpcError) throw rpcError;

      const mapped: StatsByType[] = (data ?? []).map((row: any) => ({
        type_label: String(row?.tipo ?? ''),
        count: Number(row?.conteggio ?? 0),
        total_amount_cents: Number(row?.totale_cents ?? 0),
        paid_amount_cents: Number(row?.pagato_cents ?? 0),
        residual_amount_cents: Number(row?.residuo_cents ?? 0),
        overdue_amount_cents: Number(row?.in_ritardo_cents ?? 0),
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
