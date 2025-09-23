import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { calcQuaterSaving } from "@/utils/stats-utils";

export function useQuaterSaving() {
  const [saving, setSaving] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          .from("rateations")
          .select("is_quater, original_total_due_cents, quater_total_due_cents, number, id")
          .eq("is_quater", true)
          .eq("owner_uid", session.user.id);

        if (qErr) throw qErr;

        const rows = (data ?? []).map(r => ({
          is_quater: !!r.is_quater,
          original_total_due_cents: r.original_total_due_cents ?? 0,
          quater_total_due_cents: r.quater_total_due_cents ?? 0,
          numero: r.number,
          id: r.id,
        })) as any[];

        const { quaterSaving } = calcQuaterSaving(rows);

        console.debug('[useQuaterSaving] Debug info:', {
          totalQuaterRows: rows.length,
          quaterSaving,
          sample: rows.find(r => r.numero?.includes('36') || r.id === '36'),
          allRows: rows.slice(0, 3)
        });

        if (!cancelled) setSaving(quaterSaving);
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
  }, []);

  // Listen for reload events
  useEffect(() => {
    const handleReload = () => {
      setLoading(true);
      // Trigger re-run of the main effect by changing a dependency
      window.location.reload();
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