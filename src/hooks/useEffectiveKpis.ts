import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client-resilient";
import { calcEffectiveKpis, type RateationRow } from "@/utils/stats-utils";

export function useEffectiveKpis() {
  const [kpis, setKpis] = useState({
    residualEffective: 0,
    overdueEffective: 0,
    decadutoNet: 0,
    commitmentsTotal: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadKpis = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!supabase) {
        setKpis({
          residualEffective: 0,
          overdueEffective: 0,
          decadutoNet: 0,
          commitmentsTotal: 0,
        });
        return;
      }

      // Fetch all rateations with necessary fields
      const { data: rateations, error: rateationsError } = await supabase
        .from('rateations')
        .select(`
          id,
          status,
          residual_amount_cents,
          overdue_amount_cents,
          residual_at_decadence,
          transferred_amount,
          residuoEffettivo,
          importoRitardo
        `);

      if (rateationsError) {
        throw rateationsError;
      }

      const rows = (rateations || []) as RateationRow[];
      const effectiveKpis = calcEffectiveKpis(rows);
      
      setKpis(effectiveKpis);
    } catch (err) {
      console.error('Error loading effective KPIs:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setKpis({
        residualEffective: 0,
        overdueEffective: 0,
        decadutoNet: 0,
        commitmentsTotal: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const reload = () => {
    loadKpis();
  };

  useEffect(() => {
    loadKpis();

    // Listen for reload events
    const handleReload = () => loadKpis();
    window.addEventListener('rateations:reload-kpis', handleReload);
    
    return () => {
      window.removeEventListener('rateations:reload-kpis', handleReload);
    };
  }, []);

  return {
    ...kpis,
    loading,
    error,
    reload,
  };
}