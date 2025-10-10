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

// Mapping UI label -> DB canonical value
const TYPE_LABEL_TO_DB: Record<string, string> = {
  'F24': 'F24',
  'PagoPA': 'PAGOPA',
  'Rottamazione Quater': 'Rottamazione Quater',
  'Riam. Quater': 'Riammissione Quater',
  'Altro': 'ALTRO',
};

function buildTypesArg(selected: string[] | null | undefined): string[] | null {
  const labels = selected ?? [];
  const ALL = Object.keys(TYPE_LABEL_TO_DB);
  // Nessun tipo o tutti i tipi selezionati => nessun filtro
  if (labels.length === 0 || labels.length === ALL.length) return null;
  return labels.map(l => TYPE_LABEL_TO_DB[l] ?? l);
}

function buildStatusesArg(filters: StatsFilters): string[] | null {
  const toLower = (s?: string) => (s ?? '').toLowerCase();
  const CLOSED = ['interrotta', 'estinta'];
  const OPERATIVE = ['attiva', 'in_ritardo', 'completata', 'decaduta'];

  const input = (filters.statuses ?? []).map(toLower);

  if (!filters.includeClosed) {
    if (input.length === 0) return OPERATIVE;
    const onlyOpen = input.filter(s => !CLOSED.includes(s));
    return onlyOpen.length ? onlyOpen : ['__no_match__'];
  }
  // includeClosed ON: se niente selezionato → nessun filtro
  return input.length ? input : null;
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
      p_date_from: toYMD(filters.startDate),
      p_date_to: toYMD(filters.endDate),
      p_states: buildStatusesArg(filters),
      p_types: buildTypesArg(filters.typeLabels),
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
