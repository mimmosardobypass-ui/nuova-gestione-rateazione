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

  // Calculate total count
  const totalCount = atRiskF24s.length + atRiskPagopas.length + atRiskQuaters.length;

  // Fetch total residual for all at-risk rateations
  useEffect(() => {
    const fetchResidual = async () => {
      if (totalCount === 0) {
        setTotalResidual(BigInt(0));
        return;
      }

      // Check if supabase client is available
      if (!supabase) {
        console.error('[useAllAtRisk] Supabase client not available');
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

        console.log('[useAllAtRisk] Fetching residual for IDs:', allIds);

        // Fetch residual amounts from v_rateations_list_ui
        const { data, error } = await supabase
          .from('v_rateations_list_ui')
          .select('residual_effective_cents')
          .in('id', allIds);

        if (error) {
          console.error('[useAllAtRisk] Query error:', error);
          throw error;
        }

        console.log('[useAllAtRisk] Received data:', data);

        // Sum up all residuals with safe BigInt conversion
        const total = (data || []).reduce((sum, row) => {
          try {
            const cents = row.residual_effective_cents;
            if (cents === null || cents === undefined) return sum;
            // Handle string or number
            const numValue = typeof cents === 'string' ? parseInt(cents, 10) : Number(cents);
            if (isNaN(numValue) || !isFinite(numValue)) return sum;
            return sum + BigInt(Math.floor(numValue));
          } catch (e) {
            console.warn('[useAllAtRisk] Invalid residual_effective_cents:', row.residual_effective_cents, e);
            return sum;
          }
        }, BigInt(0));

        console.log('[useAllAtRisk] Total residual calculated:', total.toString());
        setTotalResidual(total);
      } catch (err) {
        console.error('[useAllAtRisk] Error fetching residual:', err);
        setErrorResidual(err instanceof Error ? err.message : 'Errore sconosciuto nel caricamento residuo');
      } finally {
        setLoadingResidual(false);
      }
    };

    fetchResidual();
  }, [atRiskF24s, atRiskPagopas, atRiskQuaters, totalCount]);

  // Combine loading and error states
  const loading = loadingF24 || loadingPagopa || loadingQuater || loadingResidual;
  const error = errorF24 || errorPagopa || errorQuater || errorResidual;

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
