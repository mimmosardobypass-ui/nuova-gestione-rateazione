import { useEffect, useState } from "react";
import { useF24AtRisk, F24AtRiskItem } from "./useF24AtRisk";
import { usePagopaAtRisk, PagopaAtRiskItem } from "./usePagopaAtRisk";
import { useQuaterAtRisk, QuaterAtRiskItem } from "./useQuaterAtRisk";
import { supabase } from "@/integrations/supabase/client-resilient";

export interface AllAtRiskData {
  f24AtRisk: F24AtRiskItem[];
  pagopaAtRisk: PagopaAtRiskItem[];
  quaterAtRisk: QuaterAtRiskItem[];
  totalCount: number;
  totalResidual: bigint;
  loading: boolean;
  error: string | null;
}

export function useAllAtRisk(): AllAtRiskData {
  const { atRiskF24s, loading: loadingF24, error: errorF24 } = useF24AtRisk();
  const { atRiskPagopas, loading: loadingPagopa, error: errorPagopa } = usePagopaAtRisk();
  const { atRiskQuaters, loading: loadingQuater, error: errorQuater } = useQuaterAtRisk();
  
  const [totalResidual, setTotalResidual] = useState<bigint>(BigInt(0));
  const [loadingResidual, setLoadingResidual] = useState(false);
  const [errorResidual, setErrorResidual] = useState<string | null>(null);

  // Check if all child hooks have finished loading (not in grace period)
  const childHooksLoading = loadingF24 || loadingPagopa || loadingQuater;
  
  // Calculate total count
  const totalCount = atRiskF24s.length + atRiskPagopas.length + atRiskQuaters.length;

  // Fetch total residual for all at-risk rateations
  // Only run when all child hooks have finished loading
  useEffect(() => {
    // Don't fetch residual while child hooks are still loading
    if (childHooksLoading) {
      return;
    }

    const fetchResidual = async () => {
      if (totalCount === 0) {
        setTotalResidual(BigInt(0));
        return;
      }

      // Check if supabase client is available
      if (!supabase) {
        setErrorResidual('Database non disponibile');
        return;
      }

      setLoadingResidual(true);
      setErrorResidual(null);

      try {
        // Combine all IDs
        const allIds = [
          ...atRiskF24s.map(f => f.rateationId),
          ...atRiskPagopas.map(p => p.rateationId),
          ...atRiskQuaters.map(q => q.rateationId)
        ];

        if (allIds.length === 0) {
          setTotalResidual(BigInt(0));
          return;
        }

        // Fetch residual amounts from v_rateations_list_ui
        const { data, error } = await supabase
          .from('v_rateations_list_ui')
          .select('residual_effective_cents')
          .in('id', allIds);

        if (error) {
          throw error;
        }

        // Sum up all residuals with safe BigInt conversion
        const total = (data || []).reduce((sum, row) => {
          try {
            const cents = row.residual_effective_cents;
            if (cents === null || cents === undefined) return sum;
            const numValue = typeof cents === 'string' ? parseInt(cents, 10) : Number(cents);
            if (isNaN(numValue) || !isFinite(numValue)) return sum;
            return sum + BigInt(Math.floor(numValue));
          } catch {
            return sum;
          }
        }, BigInt(0));

        setTotalResidual(total);
      } catch (err) {
        setErrorResidual(err instanceof Error ? err.message : 'Errore sconosciuto nel caricamento residuo');
      } finally {
        setLoadingResidual(false);
      }
    };

    fetchResidual();
  }, [atRiskF24s, atRiskPagopas, atRiskQuaters, totalCount, childHooksLoading]);

  // Combine loading states - loading while ANY child hook is loading
  const loading = childHooksLoading || loadingResidual;
  
  // Combine error states
  // Don't promote session errors if hooks are still loading (in grace period)
  // Only show error if all hooks finished loading
  let error: string | null = null;
  if (!childHooksLoading) {
    // Only show the first actual error (not just "session not available" during grace)
    error = errorF24 || errorPagopa || errorQuater || errorResidual;
  }

  return {
    f24AtRisk: atRiskF24s,
    pagopaAtRisk: atRiskPagopas,
    quaterAtRisk: atRiskQuaters,
    totalCount,
    totalResidual,
    loading,
    error,
  };
}
