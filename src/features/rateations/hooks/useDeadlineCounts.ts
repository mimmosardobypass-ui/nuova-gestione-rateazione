import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client-resilient';
import type { DeadlineFilters } from './useDeadlines';

interface DeadlineCounts {
  paid: number;
  unpaid: number;
  total: number;
}

export function useDeadlineCounts(filters: DeadlineFilters = {}) {
  return useQuery({
    queryKey: ['deadline-counts', filters],
    queryFn: async (): Promise<DeadlineCounts> => {
      if (!supabase) {
        return { paid: 0, unpaid: 0, total: 0 };
      }
      
      const { data, error } = await supabase.rpc('deadlines_counts', {
        p_start_date: filters.startDate || null,
        p_end_date: filters.endDate || null,
        p_type_ids: filters.typeIds || null,
        p_bucket: !filters.bucket || filters.bucket === 'all' ? null : filters.bucket,
        p_search: filters.search || null,
      });

      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;
      return {
        paid: Number(row?.paid_count || 0),
        unpaid: Number(row?.unpaid_count || 0),
        total: Number(row?.total_count || 0),
      };
    },
  });
}