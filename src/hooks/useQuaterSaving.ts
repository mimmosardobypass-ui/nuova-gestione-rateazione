import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { calcQuaterSavingFromLinks } from "@/utils/stats-utils";

type RowLite = {
  id: string;
  is_quater: boolean;
  rq_target_ids: string[] | null;
  residual_amount_cents: number | null;
  quater_total_due_cents: number | null;
};

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

        // prendiamo TUTTE le rateazioni dell'utente con i campi necessari
        const { data, error: qErr } = await supabase
          .from("rateations")
          .select("id, is_quater, residual_amount_cents, quater_total_due_cents")
          .eq("owner_uid", session.user.id);

        if (qErr) throw qErr;

        // otteniamo i collegamenti RQ -> PagoPA
        const { data: links, error: linksErr } = await supabase
          .from("riam_quater_links")
          .select("riam_quater_id, pagopa_id");

        if (linksErr) throw linksErr;

        // mappa rq_id -> array di pagopa_ids
        const rqToTargets = new Map<string, string[]>();
        (links ?? []).forEach(link => {
          const rqId = String(link.riam_quater_id);
          const pagopaId = String(link.pagopa_id);
          if (!rqToTargets.has(rqId)) {
            rqToTargets.set(rqId, []);
          }
          rqToTargets.get(rqId)?.push(pagopaId);
        });

        // mappiamo nel formato atteso dalla funzione
        const rows = (data ?? []).map((r: any) => ({
          id: String(r.id),
          is_quater: !!r.is_quater,
          rq_target_ids: rqToTargets.get(String(r.id)) ?? [],
          residuo: (r.residual_amount_cents ?? 0) / 100,          // euro
          quater_total_due_cents: r.quater_total_due_cents ?? 0,  // cents
          quater_total_due: (r.quater_total_due_cents ?? 0) / 100 // euro
        })) as any[];

        const { quaterSaving } = calcQuaterSavingFromLinks(rows);

        console.debug('[useQuaterSaving] Debug info:', {
          totalRows: rows.length,
          quaterRows: rows.filter(r => r.is_quater).length,
          linksCount: (links ?? []).length,
          quaterSaving,
          sampleRQ: rows.find(r => r.is_quater),
          sampleTargets: rqToTargets.size > 0 ? Array.from(rqToTargets.entries())[0] : null
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