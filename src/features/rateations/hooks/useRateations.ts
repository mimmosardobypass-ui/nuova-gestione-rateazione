import { useState, useCallback, useEffect } from "react";
import { toast } from "@/hooks/use-toast";
import { useOnline } from "@/hooks/use-online";
import { useAuth } from "@/contexts/AuthContext";
import type { RateationRow } from "../types";
import { fetchRateations, deleteRateation } from "../api/rateations";
import { fetchRateationsSummaryEnhanced, type RateationSummaryEnhanced } from "../api/enhanced";

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
      // Use the enhanced summary view with improved calculations
      const data = await fetchRateationsSummaryEnhanced(controller.signal);

      if (controller.signal.aborted) return;

      // Transform the data to match the expected RateationRow format
      const processedRows: RateationRow[] = data.map(row => ({
        id: row.id?.toString() || "",
        numero: row.number || "",
        tipo: row.type_name || "",
        contribuente: row.taxpayer_name || "",
        importoTotale: row.total_amount || 0,
        importoPagato: row.amount_paid || 0,
        importoRitardo: row.amount_overdue || 0,
        residuo: row.amount_residual || 0,
        rateTotali: row.installments_total || 0,
        ratePagate: row.installments_paid || 0,
        rateNonPagate: row.installments_unpaid || 0,
        rateInRitardo: row.installments_overdue || 0,
      }));

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