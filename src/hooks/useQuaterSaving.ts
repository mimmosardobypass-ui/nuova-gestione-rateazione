import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

export function useQuaterSaving() {
  const [saving, setSaving] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: { session }, error: sErr } = await supabase.auth.getSession();
        if (sErr) throw sErr;
        
        if (!session?.user) { 
          if (!cancelled) {
            setSaving(0);
            setLoading(false);
          }
          return; 
        }

        const { data, error: qErr } = await supabase
          .from("v_quater_saving_per_user")
          .select("saving_eur")
          .eq("owner_uid", session.user.id)
          .single();

        if (qErr && qErr.code !== "PGRST116") throw qErr; // "no rows found" is OK
        
        if (!cancelled) setSaving(Number(data?.saving_eur ?? 0));
      } catch (e: any) {
        console.error('[useQuaterSaving] Error:', e);
        if (!cancelled) { 
          setError(e?.message ?? "Errore nel caricamento risparmio RQ"); 
          setSaving(0); 
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [reloadTrigger]);

  // Listen for reload events
  useEffect(() => {
    const handleReload = () => {
      setReloadTrigger(prev => prev + 1);
    };

    window.addEventListener('rateations:reload-kpis', handleReload);
    return () => window.removeEventListener('rateations:reload-kpis', handleReload);
  }, []);

  return {
    saving,
    loading,
    error,
    reload: () => {
      window.dispatchEvent(new Event('rateations:reload-kpis'));
    },
  };
}