/**
 * Main hook for Statistics Dashboard
 * Fetches data via get_filtered_stats() RPC + v_quater_saving_per_user
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
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

export function useStats(filters: StatsFilters): UseStatsResult {
  const [stats, setStats] = useState<FilteredStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { saving: quaterSaving, loading: savingLoading } = useQuaterSaving();

  // Normalizza payload per la RPC
  const rpcArgs = useMemo(() => {
    const toYMD = (d?: string | Date | null) =>
      d ? new Date(d).toISOString().slice(0, 10) : null;

    return {
      p_start_date: toYMD(filters.startDate),
      p_end_date: toYMD(filters.endDate),
      p_type_labels: buildTypesArg(filters.typeLabels),
      p_statuses: buildStatusesArg(filters),
      p_taxpayer_search: filters.taxpayerSearch || null,
      p_owner_only: !!filters.ownerOnly,
    };
  }, [filters]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc('get_filtered_stats', rpcArgs);

      if (rpcError) throw rpcError;
      setStats(data as FilteredStats);
    } catch (e: any) {
      console.error('[useStats]', e);
      setError(e?.message ?? 'Errore caricamento statistiche');
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [rpcArgs]);

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
