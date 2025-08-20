import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { MonthlyMetric, MatrixData } from '@/features/rateations/types/monthly-matrix';

export function useMonthlyMatrix() {
  const [data, setData] = useState<MatrixData>({});
  const [years, setYears] = useState<number[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: metricsData, error: fetchError } = await supabase
          .from('v_monthly_metrics')
          .select('*')
          .order('year', { ascending: true })
          .order('month', { ascending: true });

        if (fetchError) throw fetchError;

        const matrix: MatrixData = {};
        let minYear = Infinity;
        let maxYear = -Infinity;

        (metricsData || []).forEach((m: any) => {
          const metric: MonthlyMetric = {
            year: Number(m.year),
            month: Number(m.month),
            due_amount: Number(m.due_amount || 0),
            paid_amount: Number(m.paid_amount || 0),
            overdue_amount: Number(m.overdue_amount || 0),
            extra_ravv_amount: Number(m.extra_ravv_amount || 0),
            installments_count: Number(m.installments_count || 0),
            paid_count: Number(m.paid_count || 0),
          };
          if (!matrix[metric.year]) matrix[metric.year] = {};
          matrix[metric.year][metric.month] = metric;

          minYear = Math.min(minYear, metric.year);
          maxYear = Math.max(maxYear, metric.year);
        });

        // se non ci sono dati, esci "pulito"
        if (!Number.isFinite(minYear)) {
          setData({});
          setYears([]);
          return;
        }

        // Rendi il range anni contiguo (minYear..maxYear) e riempi mesi mancanti
        for (let y = minYear; y <= maxYear; y++) {
          if (!matrix[y]) matrix[y] = {};
          for (let m = 1; m <= 12; m++) {
            if (!matrix[y][m]) {
              matrix[y][m] = {
                year: y,
                month: m,
                due_amount: 0,
                paid_amount: 0,
                overdue_amount: 0,
                extra_ravv_amount: 0,
                installments_count: 0,
                paid_count: 0,
              };
            }
          }
        }

        setData(matrix);
        setYears(Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i));
      } catch (err: any) {
        console.error('useMonthlyMatrix error:', err);
        setError(err?.message || 'Errore nel caricamento');
      } finally {
        setLoading(false);
      }
    })();
  }, [session]);

  return { data, years, loading, error };
}