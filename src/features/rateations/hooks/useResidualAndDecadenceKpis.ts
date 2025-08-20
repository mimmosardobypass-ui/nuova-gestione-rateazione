import * as React from "react";
import { fetchResidualEuro } from "@/features/rateations/api/kpi";
import { fetchDecadenceDashboardEuros } from "@/features/rateations/api/decadence";

export function useResidualAndDecadenceKpis() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [residualEuro, setResidualEuro] = React.useState(0);
  const [decNetEuro, setDecNetEuro] = React.useState(0);
  const [decGrossEuro, setDecGrossEuro] = React.useState(0);
  const [decTransferredEuro, setDecTransferredEuro] = React.useState(0);

  const load = React.useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      setError(null);

      const [resid, dec] = await Promise.all([
        fetchResidualEuro(signal),
        fetchDecadenceDashboardEuros(signal),
      ]);

      setResidualEuro(resid || 0);
      setDecNetEuro(dec.netToTransferEuro || 0);
      setDecGrossEuro(dec.grossDecayedEuro || 0);
      setDecTransferredEuro(dec.transferredEuro || 0);
    } catch (e: any) {
      if (signal?.aborted || (e?.message === "AbortError")) return;
      console.warn("useResidualAndDecadenceKpis.load error:", e);
      setError(e?.message || "Errore caricamento KPI");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  // Reload when the rest of the app dispatches the KPI event
  React.useEffect(() => {
    const handler = () => load();
    window.addEventListener("rateations:reload-kpis", handler);
    return () => window.removeEventListener("rateations:reload-kpis", handler);
  }, [load]);

  return {
    loading,
    error,
    residualEuro,
    decNetEuro,
    decGrossEuro,
    decTransferredEuro,
    totalEuro: Math.max(0, (residualEuro || 0) + (decNetEuro || 0)),
    reload: load,
  };
}