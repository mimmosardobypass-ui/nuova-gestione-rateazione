import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client-resilient";

export function useQuinquiesSaving() {
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

      // Use v_quinquies_saving_per_user (already aggregated per user, in EUR)
      const { data, error: savingError } = await supabase
        .from("v_quinquies_saving_per_user")
        .select("saving_eur")
        .eq("owner_uid", user.id)
        .maybeSingle();

      if (savingError) {
        console.error("Error fetching R5 savings:", savingError);
        throw savingError;
      }

      // saving_eur is already in EUR, no conversion needed
      setSaving(data?.saving_eur ?? 0);
    } catch (e: any) {
      console.error("[QuinquiesSaving]", e);
      setError(e.message || "Errore nel caricamento risparmio R5");
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
