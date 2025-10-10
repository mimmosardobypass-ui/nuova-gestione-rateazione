/**
 * Hook per statistiche per tipologia con regola F24↔PagoPA
 * Usa la RPC stats_per_tipologia_effective() che esclude residui/ritardi
 * delle F24 interrotte per link PagoPA
 */

import { useState, useEffect, useCallback } from 'react';
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Calcola effectiveStatuses con la stessa logica di useStats
      let effectiveStatuses = filters.statuses;

      const CLOSED = ['INTERROTTA', 'interrotta', 'ESTINTA', 'estinta'];
      const OPERATIVE = [
        'ATTIVA', 'attiva',
        'IN_RITARDO', 'in_ritardo',
        'COMPLETATA', 'completata',
        'DECADUTA', 'decaduta',
      ];

      if (!filters.includeClosed) {
        if (!filters.statuses || filters.statuses.length === 0) {
          effectiveStatuses = OPERATIVE;
        } else {
          effectiveStatuses = filters.statuses.filter(s => !CLOSED.includes(s));
          if (effectiveStatuses.length === 0) {
            effectiveStatuses = ['__NO_MATCH__'];
          }
        }
      }

      // Chiama RPC stats_per_tipologia_effective
      const { data, error: rpcError } = await supabase.rpc(
        'stats_per_tipologia_effective',
        {
          p_date_from: filters.startDate,
          p_date_to: filters.endDate,
          p_states: effectiveStatuses,
          p_types: filters.typeLabels,
          p_include_interrupted_estinte: filters.includeClosed,
        }
      );

      if (rpcError) throw rpcError;

      // Mappa i risultati al formato StatsByType
      const mapped: StatsByType[] = (data || []).map((row: any) => ({
        type_label: row.tipo,
        count: row.conteggio,
        total_amount_cents: row.totale_cents,
        paid_amount_cents: row.pagato_cents,
        residual_amount_cents: row.residuo_cents,
        overdue_amount_cents: row.in_ritardo_cents,
      }));

      setByType(mapped);
    } catch (e: any) {
      console.error('[useStatsByTypeEffective]', e);
      setError(e.message || 'Errore caricamento statistiche per tipologia');
      setByType([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

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
