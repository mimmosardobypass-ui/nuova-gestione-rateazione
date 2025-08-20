import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface MonthlyMetric {
  owner_uid: string;
  year: number;
  month: number;
  due_amount: number;
  paid_amount: number;
  overdue_amount: number;
  extra_ravv_amount: number;
  installments_count: number;
  paid_count: number;
}

export interface MatrixData {
  [year: number]: {
    [month: number]: MonthlyMetric;
  };
}

export interface MonthlyMatrixResult {
  data: MatrixData;
  years: number[];
  loading: boolean;
  error: string | null;
}

export const useMonthlyMatrix = (): MonthlyMatrixResult => {
  const [data, setData] = useState<MatrixData>({});
  const [years, setYears] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: metricsData, error: fetchError } = await supabase
          .from('v_monthly_metrics')
          .select('*')
          .order('year', { ascending: true })
          .order('month', { ascending: true });

        if (fetchError) {
          throw fetchError;
        }

        // Transform flat data into nested structure
        const matrixData: MatrixData = {};
        const uniqueYears = new Set<number>();

        metricsData?.forEach((metric: MonthlyMetric) => {
          const { year, month } = metric;
          
          if (!matrixData[year]) {
            matrixData[year] = {};
          }
          
          matrixData[year][month] = metric;
          uniqueYears.add(year);
        });

        // Fill missing months with empty data for complete matrix
        Array.from(uniqueYears).forEach(year => {
          for (let month = 1; month <= 12; month++) {
            if (!matrixData[year][month]) {
              matrixData[year][month] = {
                owner_uid: session?.user?.id || '',
                year,
                month,
                due_amount: 0,
                paid_amount: 0,
                overdue_amount: 0,
                extra_ravv_amount: 0,
                installments_count: 0,
                paid_count: 0,
              };
            }
          }
        });

        setData(matrixData);
        setYears(Array.from(uniqueYears).sort((a, b) => a - b));
      } catch (err) {
        console.error('Error fetching monthly matrix data:', err);
        setError(err instanceof Error ? err.message : 'Error loading data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [session]);

  return { data, years, loading, error };
};