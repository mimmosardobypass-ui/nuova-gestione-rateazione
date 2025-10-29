import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { 
  MonthlyMetricByType, 
  MatrixByTypeFilters, 
  MatrixByTypeData,
  TypeMonthlyData,
  YearMonthlyData 
} from "../types/matrix-by-type";

export function useMonthlyMatrixByType(filters: MatrixByTypeFilters) {
  const { session } = useAuth();
  const [data, setData] = useState<MatrixByTypeData>({});
  const [years, setYears] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user?.id) {
      setLoading(false);
      return;
    }

    const abortController = new AbortController();

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const { data: rawData, error: fetchError } = await supabase
          .from("v_monthly_metrics_by_type")
          .select("*")
          .eq("owner_uid", session.user.id);

        if (fetchError) throw fetchError;
        if (!rawData || rawData.length === 0) {
          setData({});
          setYears([]);
          setLoading(false);
          return;
        }

        // Apply filters and transform data
        const metrics = rawData as MonthlyMetricByType[];
        const processedData = processMetrics(metrics, filters);
        
        setData(processedData);
        setYears(Object.keys(processedData).map(Number).sort());
      } catch (err) {
        if (!abortController.signal.aborted) {
          console.error("Error fetching monthly matrix by type:", err);
          setError(err instanceof Error ? err.message : "Failed to load data");
        }
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      abortController.abort();
    };
  }, [session?.user?.id, filters.payFilter, filters.yearFilter]);

  return { data, years, loading, error };
}

function processMetrics(
  metrics: MonthlyMetricByType[], 
  filters: MatrixByTypeFilters
): MatrixByTypeData {
  const result: MatrixByTypeData = {};

  // Filter by year if specified
  let filteredMetrics = filters.yearFilter 
    ? metrics.filter(m => m.year === filters.yearFilter)
    : metrics;

  // Get all unique types from data
  const allTypes = [...new Set(filteredMetrics.map(m => m.type_label))];

  // Get all years
  const allYears = [...new Set(filteredMetrics.map(m => m.year))].sort();

  for (const year of allYears) {
    const yearData: YearMonthlyData = {
      totals: {},
      progressive: {},
    };

    // Initialize all types for this year
    for (const type of allTypes) {
      yearData[type] = {};
      for (let month = 1; month <= 12; month++) {
        yearData[type][month] = 0;
      }
    }

    // Fill in actual data
    const yearMetrics = filteredMetrics.filter(m => m.year === year);
    
    for (const metric of yearMetrics) {
      const amount = getAmountForPayFilter(metric, filters.payFilter);
      
      if (!yearData[metric.type_label]) {
        yearData[metric.type_label] = {};
      }
      
      yearData[metric.type_label][metric.month] = amount;
    }

    // Calculate totals and progressive for each month
    for (let month = 1; month <= 12; month++) {
      let monthTotal = 0;
      
      for (const type of allTypes) {
        monthTotal += yearData[type]?.[month] || 0;
      }
      
      yearData.totals[month] = monthTotal;
    }

    // Calculate progressive (cumulative from January)
    let cumulative = 0;
    for (let month = 1; month <= 12; month++) {
      cumulative += yearData.totals[month] || 0;
      yearData.progressive[month] = cumulative;
    }

    result[year] = yearData;
  }

  return result;
}

function getAmountForPayFilter(
  metric: MonthlyMetricByType, 
  payFilter: MatrixByTypeFilters['payFilter']
): number {
  switch (payFilter) {
    case 'unpaid':
      // Non pagate = Dovuto - Pagato (debito residuo)
      return Math.max(0, metric.due_amount_cents - metric.paid_amount_cents);
    case 'paid':
      // Solo pagato
      return metric.paid_amount_cents;
    case 'all':
    default:
      // Tutto dovuto
      return metric.due_amount_cents;
  }
}
