import { useState, useCallback, useEffect } from "react";
import { toast } from "@/hooks/use-toast";
import { useOnline } from "@/hooks/use-online";
import type { RateationRow } from "../types";
import { deleteRateation } from "../api/rateations";
import { supabase } from "@/integrations/supabase/client";

export const useRateations = () => {
  const [rows, setRows] = useState<RateationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const online = useOnline();

  const loadData = useCallback(async () => {
    if (!online) {
      setError("Offline - impossibile caricare i dati");
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    try {
      console.log("[useRateationsWorking] Starting loadData, online:", online);
      // Get current user first - same as useRateationStats
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn("[useRateationsWorking] User not authenticated, skipping data load");
        setLoading(false);
        return;
      }

      console.debug("[useRateationsWorking] Loading data for user:", user.id);

      if (controller.signal.aborted) return;

      // 1) Prendo le rateazioni dell'utente (RLS-friendly) con created_at per sort
      const t0 = performance.now?.() ?? Date.now();
      const { data: rateations, error: rateationsError } = await supabase
        .from("rateations")
        .select("id, number, type_id, taxpayer_name, created_at")
        .eq("owner_uid", user.id);
      const t1 = performance.now?.() ?? Date.now();
      if (rateationsError) throw rateationsError;

      const rateationIds = (rateations || []).map(r => r.id);
      console.log("[useRateationsWorking] rateations fetched:", {
        userId: user.id,
        count: rateations?.length ?? 0,
        rateations: rateations,
        rateationIds: rateationIds,
        ms: Math.round(t1 - t0),
      });
      if (rateationIds.length === 0) {
        console.warn("[useRateationsWorking] nessuna rateazione trovata per l'utente. Verificare backfill owner_uid/RLS.");
        setRows([]);
        setLoading(false);
        return;
      }

      // 2) Installments solo per le rateazioni dell'utente
      const t2 = performance.now?.() ?? Date.now();
      const { data: installments, error: installmentsError } = await supabase
        .from("installments")
        .select("rateation_id, amount, is_paid, due_date, paid_at")
        .in("rateation_id", rateationIds);
      const t3 = performance.now?.() ?? Date.now();
      if (installmentsError) throw installmentsError;
      console.log("[useRateationsWorking] installments fetched:", {
        count: installments?.length ?? 0,
        installments: installments,
        ms: Math.round(t3 - t2),
      });

      // 3) Tipi (nome tipo)
      const { data: types, error: typesError } = await supabase
        .from("rateation_types")
        .select("id, name");
      if (typesError) throw typesError;

      const typesMap = Object.fromEntries((types || []).map(t => [t.id, t.name as string]));
      const today = new Date(); 
      today.setHours(0, 0, 0, 0);

      // Process each rateation with custom late logic
      const processedRows: (RateationRow & { _createdAt: string | null })[] = (rateations || []).map(r => {
        const its = (installments || []).filter(i => i.rateation_id === r.id);

        const rateTotali = its.length;
        const ratePagate = its.filter(i => i.is_paid).length;
        const rateNonPagate = rateTotali - ratePagate;

        // Overdue correnti: scadute e NON pagate
        const rateInRitardo = its.filter(i => {
          if (i.is_paid) return false;
          if (!i.due_date) return false;
          const due = new Date(i.due_date);
          due.setHours(0, 0, 0, 0);
          return due < today;
        }).length;

        // Pagate in ritardo: paid_at > due_date (storico)
        const ratePaidLate = its.filter(i => {
          if (!i.is_paid || !i.due_date || !i.paid_at) return false;
          const due = new Date(i.due_date);
          due.setHours(0, 0, 0, 0);
          const paid = new Date(i.paid_at);
          paid.setHours(0, 0, 0, 0);
          return paid > due;
        }).length;

        const importoTotale = its.reduce((s, i) => s + (i.amount || 0), 0);
        const importoPagato = its.filter(i => i.is_paid).reduce((s, i) => s + (i.amount || 0), 0);
        const importoRitardo = its
          .filter(i => !i.is_paid && i.due_date && new Date(new Date(i.due_date).setHours(0, 0, 0, 0)) < today)
          .reduce((s, i) => s + (i.amount || 0), 0);
        const residuo = importoTotale - importoPagato;

        return {
          id: String(r.id),
          numero: r.number || "",
          tipo: typesMap[r.type_id] || "N/A",
          contribuente: r.taxpayer_name || "",
          importoTotale,
          importoPagato,
          importoRitardo,
          residuo,
          rateTotali,
          ratePagate,
          rateNonPagate,
          rateInRitardo,   // overdue correnti
          ratePaidLate,    // NEW: pagate in ritardo (storico)
          // ausiliario per sort (non esposto in UI)
          _createdAt: r.created_at || null,
        };
      });

      // Ordinamento per created_at discendente per coerenza con la UI
      processedRows.sort((a, b) => {
        const da = a._createdAt ? new Date(a._createdAt).getTime() : 0;
        const db = b._createdAt ? new Date(b._createdAt).getTime() : 0;
        return db - da;
      });
      console.log("[useRateationsWorking] processed rows:", {
        count: processedRows.length,
        finalRows: processedRows.map(({ _createdAt, ...rest }) => rest)
      });
      
      if (controller.signal.aborted) return;
      // rimuovo proprietà ausiliaria prima di passare i dati alla UI
      const finalRows = processedRows.map(({ _createdAt, ...rest }) => rest);
      
      console.log("[useRateationsWorking] About to call setRows with:", {
        finalRowsCount: finalRows.length,
        finalRowsData: finalRows,
        wasAborted: controller.signal.aborted
      });
      
      setRows(finalRows);
      
      console.log("[useRateationsWorking] setRows completed successfully");
    } catch (err) {
      if (controller.signal.aborted || (err instanceof Error && err.message === 'AbortError')) {
        console.debug('[ABORT] useRateations loadData');
        return;
      }
      const message = err instanceof Error ? err.message : "Errore sconosciuto";
      setError(message);
      setRows([]); // Always set empty array on error, never demo data
      toast({
        title: "Errore nel caricamento",
        description: message,
        variant: "destructive",
      });
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }

    return () => controller.abort();
  }, [online]);

  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = useCallback(async (id: string, debouncedReloadStats?: () => void) => {
    if (!online) {
      toast({
        title: "Offline",
        description: "Impossibile eliminare offline",
        variant: "destructive",
      });
      return;
    }

    if (deleting) {
      toast({
        title: "Operazione in corso",
        description: "Attendi il completamento dell'eliminazione",
        variant: "destructive",
      });
      return;
    }

    if (!confirm("Sei sicuro di voler eliminare questa rateazione e tutte le sue rate?")) {
      return;
    }

    setDeleting(id);
    try {
      await deleteRateation(id);
      toast({
        title: "Eliminata",
        description: "Rateazione eliminata con successo",
      });
      await loadData(); // Reload data
      debouncedReloadStats?.(); // Reload stats
    } catch (err) {
      const message = err instanceof Error ? err.message : "Errore nell'eliminazione";
      toast({
        title: "Errore",
        description: message,
        variant: "destructive",
      });
    } finally {
      setDeleting(null);
    }
  }, [online, loadData, deleting]);

  useEffect(() => {
    console.log("[useRateationsWorking] useEffect called, about to run loadData");
    const cleanup = loadData();
    return () => {
      console.log("[useRateationsWorking] useEffect cleanup");
      if (cleanup instanceof Function) cleanup();
    };
  }, [loadData]);

  return {
    rows,
    loading,
    error,
    online,
    loadData,
    handleDelete,
    deleting,
  };
};