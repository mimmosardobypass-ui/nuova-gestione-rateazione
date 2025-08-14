import { useState, useCallback, useEffect } from "react";
import { toast } from "@/hooks/use-toast";
import { useOnline } from "@/hooks/use-online";
import { useAuth } from "@/contexts/AuthContext";
import type { RateationRow } from "../types";
import { fetchRateations, deleteRateation } from "../api/rateations";
import { supabase } from "@/integrations/supabase/client";

export const useRateations = () => {
  const [rows, setRows] = useState<RateationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const online = useOnline();
  const { session, authReady } = useAuth();

  const loadData = useCallback(async () => {
    // Wait for auth to be ready and user to be authenticated
    if (!authReady || !session?.user) {
      console.debug('[useRateations] Waiting for auth or user session');
      return;
    }

    if (!online) {
      setError("Offline - impossibile caricare i dati");
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    try {
      // Fetch data separately to implement custom late logic

      if (controller.signal.aborted) return;

      // We need to fetch rateations and installments separately to implement custom logic
      const { data: rateations, error: rateationsError } = await supabase
        .from("rateations")
        .select(`
          id, number, type_id, taxpayer_name,
          rateation_types (name)
        `);

      if (rateationsError) throw rateationsError;

      const { data: installments, error: installmentsError } = await supabase
        .from("installments")
        .select("*");

      if (installmentsError) throw installmentsError;

      const { data: types, error: typesError } = await supabase
        .from("rateation_types")
        .select("*");

      if (typesError) throw typesError;

      const typesMap = types?.reduce((acc, type) => ({
        ...acc,
        [type.id]: type.name
      }), {} as Record<number, string>) || {};

      // Process each rateation with custom late logic
      const processedRows: RateationRow[] = (rateations || []).map(r => {
        const rateForThisRateation = (installments || []).filter(i => i.rateation_id === r.id);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const rateTotali = rateForThisRateation.length;
        const ratePagate = rateForThisRateation.filter(i => i.is_paid).length;
        const rateNonPagate = rateTotali - ratePagate;

        // 1) Overdue correnti: scadute e NON pagate
        const rateInRitardo = rateForThisRateation.filter(i => {
          if (i.is_paid) return false;
          if (!i.due_date) return false;
          const due = new Date(i.due_date);
          due.setHours(0, 0, 0, 0);
          return due < today;
        }).length;

        // 2) Pagate in ritardo: pagate con paid_at > due_date (storico)
        const ratePaidLate = rateForThisRateation.filter(i => {
          if (!i.is_paid) return false;
          if (!i.due_date || !i.paid_at) return false;
          const due = new Date(i.due_date);
          due.setHours(0, 0, 0, 0);
          const paid = new Date(i.paid_at);
          paid.setHours(0, 0, 0, 0);
          return paid > due;
        }).length;

        // Calculate amounts
        const importoTotale = rateForThisRateation.reduce((sum, i) => sum + (i.amount || 0), 0);
        const importoPagato = rateForThisRateation.filter(i => i.is_paid).reduce((sum, i) => sum + (i.amount || 0), 0);
        const importoRitardo = rateForThisRateation.filter(i => {
          if (i.is_paid) return false;
          if (!i.due_date) return false;
          const due = new Date(i.due_date);
          due.setHours(0, 0, 0, 0);
          return due < today;
        }).reduce((sum, i) => sum + (i.amount || 0), 0);
        const residuo = importoTotale - importoPagato;

        return {
          id: String(r.id),
          numero: r.number || "",
          tipo: typesMap[r.type_id] || "N/A",
          contribuente: r.taxpayer_name,
          importoTotale,
          importoPagato,
          importoRitardo,
          residuo,
          rateTotali,
          ratePagate,
          rateNonPagate,
          rateInRitardo,
          ratePaidLate, // NEW
        };
      });

      if (controller.signal.aborted) return;
      setRows(processedRows);
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
  }, [online, authReady, session?.user?.id]);

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
    const cleanup = loadData();
    return () => {
      if (cleanup instanceof Function) cleanup();
    };
  }, [loadData]);

  return {
    rows,
    loading,
    error,
    online,
    authReady,
    loadData,
    handleDelete,
    deleting,
  };
};