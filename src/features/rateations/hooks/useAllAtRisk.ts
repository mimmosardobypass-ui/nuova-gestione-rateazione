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
          ...atRiskPagopas.map(p => p.rateationId)
        ];

        if (allIds.length === 0) {
          setTotalResidual(BigInt(0));
          return;
        }

        console.log('[useAllAtRisk] Fetching residual for IDs:', allIds);

        // Fetch residual amounts from v_rateations_list_ui
        // NOTE: Column is residual_effective_cents, not residual
        const { data, error } = await supabase
          .from('v_rateations_list_ui')
          .select('residual_effective_cents')
          .in('id', allIds);

        if (error) {
          console.error('[useAllAtRisk] Query error:', error);
          throw error;
        }

        console.log('[useAllAtRisk] Received data:', data);

        // Sum up all residuals
        const total = (data || []).reduce((sum, row) => {
          const value = row.residual_effective_cents ? BigInt(row.residual_effective_cents) : BigInt(0);
          return sum + value;
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
