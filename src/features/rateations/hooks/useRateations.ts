import { useState, useCallback } from "react";
import { toast } from "@/hooks/use-toast";
import { useOnline } from "@/hooks/use-online";
import type { RateationRow } from "../types";
import { fetchRateations, deleteRateation } from "../api/rateations";

export const useRateations = () => {
  const [rows, setRows] = useState<RateationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const online = useOnline();

  const loadData = useCallback(async () => {
    if (!online) {
      setError("Offline - impossibile caricare i dati");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { rateations, installments, types } = await fetchRateations();

      const typesMap = Object.fromEntries(types.map(t => [t.id, t.name]));

      const processed = rateations.map(r => {
        const rateForThisRateation = installments.filter(i => i.rateation_id === r.id);
        const today = new Date().toISOString().slice(0, 10);

        const rateTotali = rateForThisRateation.length;
        const ratePagate = rateForThisRateation.filter(i => i.is_paid).length;
        const rateNonPagate = rateTotali - ratePagate;
        const rateInRitardo = rateForThisRateation.filter(
          i => !i.is_paid && i.due_date < today
        ).length;

        const importoPagato = rateForThisRateation
          .filter(i => i.is_paid)
          .reduce((sum, i) => sum + (i.amount || 0), 0);

        const importoRitardo = rateForThisRateation
          .filter(i => !i.is_paid && i.due_date < today)
          .reduce((sum, i) => sum + (i.amount || 0), 0);

        const importoTotale = r.total_amount || 0;
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
        };
      });

      setRows(processed);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Errore sconosciuto";
      setError(message);
      setRows([]); // Always set empty array on error, never demo data
      toast({
        title: "Errore nel caricamento",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [online]);

  const handleDelete = useCallback(async (id: string) => {
    if (!online) {
      toast({
        title: "Offline",
        description: "Impossibile eliminare offline",
        variant: "destructive",
      });
      return;
    }

    if (!confirm("Sei sicuro di voler eliminare questa rateazione e tutte le sue rate?")) {
      return;
    }

    try {
      await deleteRateation(id);
      toast({
        title: "Eliminata",
        description: "Rateazione eliminata con successo",
      });
      await loadData(); // Reload data
    } catch (err) {
      const message = err instanceof Error ? err.message : "Errore nell'eliminazione";
      toast({
        title: "Errore",
        description: message,
        variant: "destructive",
      });
    }
  }, [online, loadData]);

  return {
    rows,
    loading,
    error,
    online,
    loadData,
    handleDelete,
  };
};