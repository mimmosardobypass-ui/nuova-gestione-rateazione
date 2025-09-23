import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client-resilient";
import { calcQuaterSaving, type RateationRow } from "@/utils/stats-utils";

export function useQuaterSaving() {
  const [saving, setSaving] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSaving = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!supabase) {
        setSaving(0);
        return;
      }

      // Fetch only Quater rateations
      const { data: rateations, error: rateationsError } = await supabase
        .from('rateations')
        .select(`
          id,
          is_quater,
          original_total_due_cents,
          quater_total_due_cents,
          total_amount,
          status
        `)
        .eq('is_quater', true);

      if (rateationsError) {
        throw rateationsError;
      }

      const rows = (rateations || []) as RateationRow[];
      const { quaterSaving } = calcQuaterSaving(rows);
      
      setSaving(quaterSaving);
    } catch (err) {
      console.error('Error loading Quater saving:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setSaving(0);
    } finally {
      setLoading(false);
    }
  };

  const reload = () => {
    loadSaving();
  };

  useEffect(() => {
    loadSaving();

    // Listen for reload events
    const handleReload = () => loadSaving();
    window.addEventListener('rateations:reload-kpis', handleReload);
    
    return () => {
      window.removeEventListener('rateations:reload-kpis', handleReload);
    };
  }, []);

  return {
    saving,
    loading,
    error,
    reload,
  };
}