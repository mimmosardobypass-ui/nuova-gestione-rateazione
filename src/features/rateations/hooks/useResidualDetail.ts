import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client-resilient';
import type { StatsFilters, ResidualDetailRow } from '../types/stats';
import { buildTypesArg, buildStatusesArg } from '../utils/statsArgs';

interface UseResidualDetailReturn {
  rows: ResidualDetailRow[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useResidualDetail(filters: StatsFilters): UseResidualDetailReturn {
  const [rows, setRows] = useState<ResidualDetailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: rpcError } = await supabase.rpc('get_residual_detail', {
        p_start_date: filters.startDate,
        p_end_date: filters.endDate,
        p_type_labels: buildTypesArg(filters.typeLabels),
        p_statuses: buildStatusesArg(filters),
        p_taxpayer_search: filters.taxpayerSearch,
        p_owner_only: filters.ownerOnly,
      });

      if (rpcError) throw rpcError;
      setRows(data || []);
    } catch (err) {
      console.error('Error loading residual detail:', err);
      setError(err instanceof Error ? err.message : 'Errore nel caricamento dei residui');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [
    filters.startDate,
    filters.endDate,
    JSON.stringify(filters.typeLabels),
    JSON.stringify(filters.statuses),
    filters.taxpayerSearch,
    filters.ownerOnly,
    filters.includeClosed,
  ]);

  return { rows, loading, error, reload: load };
}
