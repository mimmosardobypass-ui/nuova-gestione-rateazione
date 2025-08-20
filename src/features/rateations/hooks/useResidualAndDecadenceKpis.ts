import * as React from "react";
import { fetchKpiStats } from "@/features/rateations/api/kpi";
import { fetchDecadenceDashboardEuros } from "@/features/rateations/api/decadence";

export function useResidualAndDecadenceKpis() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [residualEuro, setResidualEuro] = React.useState(0);
  const [decNetEuro, setDecNetEuro] = React.useState(0);
  const [decGrossEuro, setDecGrossEuro] = React.useState(0);
  const [decTransferredEuro, setDecTransferredEuro] = React.useState(0);

  const load = React.useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      setError(null);
      const [kpi, dec] = await Promise.all([
        fetchKpiStats(signal),
        fetchDecadenceDashboardEuros(signal),
      ]);
      setResidualEuro(kpi.residualEuro);
      setDecNetEuro(dec.netToTransferEuro);
      setDecGrossEuro(dec.grossDecayedEuro);
      setDecTransferredEuro(dec.transferredEuro);
    } catch (e: any) {
      if (signal?.aborted || (e instanceof Error && e.message === 'AbortError')) {
        return;
      }
      setError(e?.message || "Errore caricamento KPI");
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
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