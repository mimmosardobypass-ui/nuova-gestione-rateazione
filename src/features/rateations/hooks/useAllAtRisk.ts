import { useEffect, useState } from "react";
import { useF24AtRisk, F24AtRiskItem } from "./useF24AtRisk";
import { usePagopaAtRisk, PagopaAtRiskItem } from "./usePagopaAtRisk";
import { supabase } from "@/integrations/supabase/client-resilient";

export interface AllAtRiskData {
  f24AtRisk: F24AtRiskItem[];
  pagopaAtRisk: PagopaAtRiskItem[];
  totalCount: number;
  totalResidual: bigint;
  loading: boolean;
  error: string | null;
}

export function useAllAtRisk(): AllAtRiskData {
  const { atRiskF24s, loading: loadingF24, error: errorF24 } = useF24AtRisk();
  const { atRiskPagopas, loading: loadingPagopa, error: errorPagopa } = usePagopaAtRisk();
  
  const [totalResidual, setTotalResidual] = useState<bigint>(BigInt(0));
  const [loadingResidual, setLoadingResidual] = useState(false);
  const [errorResidual, setErrorResidual] = useState<string | null>(null);

  // Calculate total count
  const totalCount = atRiskF24s.length + atRiskPagopas.length;

  // Fetch total residual for all at-risk rateations
  useEffect(() => {
    const fetchResidual = async () => {
      if (totalCount === 0) {
        setTotalResidual(BigInt(0));
        return;
      }

      setLoadingResidual(true);
      setErrorResidual(null);

      try {
        // Combine all IDs
        const allIds = [
          ...atRiskF24s.map(f => f.rateationId),
          ...atRiskPagopas.map(p => p.rateationId)
        ];

        if (allIds.length === 0) {
          setTotalResidual(BigInt(0));
          return;
        }

        // Fetch residual amounts from v_rateations_list_ui
        const { data, error } = await supabase
          .from('v_rateations_list_ui')
          .select('residual')
          .in('id', allIds);

        if (error) throw error;

        // Sum up all residuals
        const total = (data || []).reduce((sum, row) => {
          return sum + (row.residual ? BigInt(row.residual) : BigInt(0));
        }, BigInt(0));

        setTotalResidual(total);
      } catch (err) {
        console.error('[useAllAtRisk] Error fetching residual:', err);
        setErrorResidual(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoadingResidual(false);
      }
    };

    fetchResidual();
  }, [atRiskF24s, atRiskPagopas, totalCount]);

  // Combine loading and error states
  const loading = loadingF24 || loadingPagopa || loadingResidual;
  const error = errorF24 || errorPagopa || errorResidual;

  return {
    f24AtRisk: atRiskF24s,
    pagopaAtRisk: atRiskPagopas,
    totalCount,
    totalResidual,
    loading,
    error,
  };
}
