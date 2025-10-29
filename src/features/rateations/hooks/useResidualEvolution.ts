import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client-resilient';
import { useAuth } from '@/contexts/AuthContext';
import type {
  ResidualEvolutionFilters,
  ResidualEvolutionData,
  KPIData,
  YearData,
  MonthlyResidualData,
  RateationType,
} from '@/features/rateations/types/residual-evolution';

interface RawRow {
  year: number;
  month: number;
  type_label: string;
  amount_cents: number;
}

export function useResidualEvolution(filters: ResidualEvolutionFilters) {
  const [data, setData] = useState<ResidualEvolutionData>({});
  const [kpis, setKpis] = useState<KPIData>({
    totalPeriod: 0,
    averageMonth: 0,
    peakMonth: 0,
    activeMonths: 0,
  });
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

        if (!supabase) {
          console.warn('Supabase client not available');
          setData({});
          setKpis({ totalPeriod: 0, averageMonth: 0, peakMonth: 0, activeMonths: 0 });
          return;
        }

        // Fetch data from RPC
        const { data: rawData, error: fetchError } = await supabase.rpc(
          'residual_evolution_by_type',
          {
            p_year_from: filters.yearFrom,
            p_year_to: filters.yearTo,
            p_pay_filter: filters.payFilter,
          }
        );

        if (fetchError) throw fetchError;

        // Process data
        const processedData: ResidualEvolutionData = {};
        const years = Array.from(
          { length: filters.yearTo - filters.yearFrom + 1 },
          (_, i) => filters.yearFrom + i
        );

        // Initialize structure
        years.forEach((year) => {
          processedData[year] = {
            progressive: {},
            totalYear: 0,
            averageMonth: 0,
          } as YearData;

          for (let month = 1; month <= 12; month++) {
            processedData[year][month] = {
              total: 0,
              F24: 0,
              PagoPa: 0,
              'Rottamazione Quater': 0,
              'Riam. Quater': 0,
            };
          }
        });

        // Populate with raw data
        (rawData || []).forEach((row: RawRow) => {
          const { year, month, type_label, amount_cents } = row;
          
          if (!processedData[year]) return;
          if (!processedData[year][month]) return;

          // Filter by selected types
          if (!filters.selectedTypes.includes(type_label as RateationType)) {
            return;
          }

          processedData[year][month][type_label] = amount_cents;
          processedData[year][month].total += amount_cents;
        });

        // Calculate progressives, totals, and averages
        years.forEach((year) => {
          let cumulativeSum = 0;
          let yearTotal = 0;

          for (let month = 1; month <= 12; month++) {
            const monthTotal = processedData[year][month].total;
            cumulativeSum += monthTotal;
            yearTotal += monthTotal;
            processedData[year].progressive[month] = cumulativeSum;
          }

          processedData[year].totalYear = yearTotal;
          processedData[year].averageMonth = Math.round(yearTotal / 12);
        });

        // Calculate KPIs
        let totalPeriod = 0;
        let peakMonth = 0;
        let activeMonths = 0;
        let totalMonths = 0;

        years.forEach((year) => {
          totalPeriod += processedData[year].totalYear;
          for (let month = 1; month <= 12; month++) {
            const monthTotal = processedData[year][month].total;
            if (monthTotal > peakMonth) peakMonth = monthTotal;
            if (monthTotal > 0) activeMonths++;
            totalMonths++;
          }
        });

        const averageMonth = totalMonths > 0 ? Math.round(totalPeriod / totalMonths) : 0;

        setData(processedData);
        setKpis({
          totalPeriod,
          averageMonth,
          peakMonth,
          activeMonths,
        });
      } catch (err: any) {
        console.error('useResidualEvolution error:', err);
        setError(err?.message || 'Errore nel caricamento');
      } finally {
        setLoading(false);
      }
    })();
  }, [session, filters.yearFrom, filters.yearTo, filters.payFilter, filters.selectedTypes]);

  return { data, kpis, loading, error };
}
