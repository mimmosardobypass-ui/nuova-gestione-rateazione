/**
 * Hook per statistiche "Per Tipologia" con regola F24↔PagoPA
 * Usa la nuova RPC stats_per_tipologia_effective che applica correttamente:
 * - Mappatura tipologie: F24, PagoPA, Rottamazione Quater, Riam. Quater, Altro
 * - Regola F24↔PagoPA: F24 interrotte per link PagoPA → residuo/ritardo = 0
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

export function useStatsByTypeEffective(filters: StatsFilters): UseStatsByTypeEffectiveResult {
  const [byType, setByType] = useState<StatsByType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Calcolo stati effettivi (stessa logica di useStats)
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

      // Chiamata RPC con regola F24↔PagoPA applicata
      const { data, error: rpcError } = await supabase.rpc('stats_per_tipologia_effective', {
        p_date_from: filters.startDate,
        p_date_to: filters.endDate,
        p_states: effectiveStatuses,
        p_types: filters.typeLabels,
        p_include_interrupted_estinte: filters.includeClosed,
      });

      if (rpcError) throw rpcError;

      // Mappa risultati alla struttura StatsByType
      const mappedData: StatsByType[] = (data || []).map((row: any) => ({
        type_label: row.tipo,
        count: Number(row.conteggio),
        total_amount_cents: Number(row.totale_cents),
        paid_amount_cents: Number(row.pagato_cents),
        residual_amount_cents: Number(row.residuo_cents),
        overdue_amount_cents: Number(row.in_ritardo_cents),
      }));

      setByType(mappedData);
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
