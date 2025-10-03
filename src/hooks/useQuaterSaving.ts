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

      // Use v_quater_saving_per_user (already aggregated per user, in EUR)
      const { data, error: savingError } = await supabase
        .from("v_quater_saving_per_user")
        .select("saving_eur")
        .eq("owner_uid", user.id)
        .maybeSingle();

      if (savingError) {
        console.error("Error fetching RQ savings:", savingError);
        throw savingError;
      }

      // saving_eur is already in EUR, no conversion needed
      setSaving(data?.saving_eur ?? 0);
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