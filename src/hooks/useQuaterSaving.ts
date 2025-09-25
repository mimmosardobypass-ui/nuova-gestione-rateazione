import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client-resilient";
import { calcQuaterSavingFromLinks } from "@/utils/quater-saving";

export function useQuaterSaving() {
  const [saving, setSaving] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSaving = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Get current user first
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Fetch RQ savings data from the aggregated view
      const { data: savingData, error: savingError } = await supabase
        .from("v_risparmio_riam_quater_aggregato")
        .select("*");

      if (savingError) {
        console.error("Error fetching RQ savings:", savingError);
        throw savingError;
      }

      // Calculate total saving using the utility function
      const { quaterSaving } = calcQuaterSavingFromLinks(
        savingData?.map(row => ({
          is_quater: true,
          allocated_residual_cents: row.residuo_pagopa_tot * 100, // Convert to cents
          quater_total_due_cents: row.totale_rq * 100 // Convert to cents
        })) || []
      );

      setSaving(quaterSaving);
    } catch (e: any) {
      console.error("[QuaterSaving]", e);
      setError(e.message || "Errore nel caricamento risparmio");
      setSaving(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSaving();
  }, [loadSaving]);

  return { saving, loading, error, reload: loadSaving };
}