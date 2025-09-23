import { useAllRateations } from "./useAllRateations";
import { calcQuaterSaving } from "@/utils/stats-utils";

export function useQuaterSaving() {
  const { rows: allRows, loading, error } = useAllRateations();
  
  // Calculate Quater saving from all rateations (including estinte/decadute)
  const { quaterSaving } = calcQuaterSaving(allRows || []);

  console.debug('[useQuaterSaving] Debug info:', {
    totalRows: allRows?.length || 0,
    quaterRows: allRows?.filter(r => r.is_quater).length || 0,
    quaterSaving,
    sample: allRows?.find(r => r.numero === '36' || r.id === '36')
  });

  return {
    saving: quaterSaving,
    loading,
    error,
    reload: () => {
      // Trigger reload through the existing event system
      window.dispatchEvent(new Event('rateations:reload-kpis'));
    },
  };
}